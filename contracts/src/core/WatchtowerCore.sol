// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {
    INativeQueryVerifier,
    NativeQueryVerifierLib
} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";
import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";

import {EvidenceInput, IWatchtowerCore} from "../interfaces/IWatchtowerCore.sol";
import {IAttestedFeed} from "../interfaces/IAttestedFeed.sol";
import {IConservationRule} from "../interfaces/IConservationRule.sol";
import {IUnderwritingVault} from "../interfaces/IUnderwritingVault.sol";
import {EvidenceLib} from "../libs/EvidenceLib.sol";
import {SubjectKey} from "../libs/SubjectKey.sol";
import {AccDelta, Settlement, SubjectView, Verdict, VerifiedTx, WindowShape} from "../types/Types.sol";
import {Subject, SubjectRegistry} from "./SubjectRegistry.sol";

/// @notice An optimistic claim awaiting its challenge window, plus the accumulator snapshot that
///         a successful gap challenge rolls back to.
struct Incident {
    bytes32 subjectId;
    bytes32 ruleId;
    address prosecutor;
    address beneficiary;
    uint256 damagesUsd;
    uint64 fromHeight; // cursor before this evidence was applied
    uint32 fromIndex;
    uint64 toHeight; // coordinate of the last applied entry
    uint32 toIndex;
    uint64 challengeDeadline;
    uint64 continuityLength;
    SubjectView snapshot;
    uint8 status; // 0 none, 1 open, 2 settled, 3 rolled back
}

/// @title WatchtowerCore
/// @notice The Attestcoin Smart Contract. The only contract in the system that speaks to the
///         Block Prover Precompile, and the only one that may move the vault.
///
/// @dev One entrypoint handles every risk: a sandwich prosecution, a reserve ingestion, a price
///      update, a gas-refund claim and a fraud proof are the same call with different rule ids.
///
///      Deliberately does NOT inherit `ASCBase`. That reference contract verifies a single
///      transaction and dedupes globally on (chainKey, height, txIndex); Watchtower needs batch
///      windows sharing one continuity proof, and rule-scoped dedupe, because one Ethereum
///      transaction is legitimately evidence under several rules at once.
contract WatchtowerCore is IWatchtowerCore, IAttestedFeed, Ownable {
    using EvidenceLib for VerifiedTx[];

    /// @notice Rule scope used by gap challenges, so a challenge never collides with the ingestion
    ///         it disputes.
    bytes32 public constant GAP_RULE = keccak256("watchtower.rule.gap-challenge.v1");

    /// @notice The Block Prover Precompile at 0x0FD2.
    INativeQueryVerifier public immutable VERIFIER;
    SubjectRegistry public immutable REGISTRY;
    IUnderwritingVault public immutable VAULT;

    uint64 public challengeWindow;

    mapping(bytes32 => SubjectView) private _state;
    mapping(bytes32 => uint64) private _priceHeight;
    mapping(bytes32 => bool) public consumed;
    mapping(bytes32 => Incident) public incidents;
    mapping(bytes32 => bool) private _anchored;

    /// @notice Unresolved optimistic breaches per subject.
    /// @dev A stream can break twice before anyone settles the first claim. Counting rather than
    ///      flag-flipping means the second breach keeps the tranche frozen after the first is paid -
    ///      otherwise settling one claim would open an exit for underwriters mid-dispute.
    mapping(bytes32 => uint256) public openBreaches;

    event EvidenceAccepted(
        bytes32 indexed subjectId,
        bytes32 indexed ruleId,
        bytes32 indexed incidentId,
        uint64 chainKey,
        uint64 blockHeight,
        uint32 txIndex,
        uint64 continuityLength
    );
    event VerdictIssued(
        bytes32 indexed incidentId,
        bytes32 indexed subjectId,
        bytes32 ruleId,
        address beneficiary,
        uint256 damagesUsd,
        uint256 paid,
        bytes32 evidenceHash
    );
    event BreachOpened(
        bytes32 indexed incidentId,
        bytes32 indexed subjectId,
        uint256 damagesUsd,
        address prosecutor,
        uint256 bond,
        uint64 challengeDeadline
    );
    event BreachSettled(bytes32 indexed incidentId, uint256 paid);
    event GapChallengeUpheld(
        bytes32 indexed incidentId, address indexed challenger, uint64 gapHeight, uint32 gapIndex
    );
    event CursorAdvanced(bytes32 indexed subjectId, uint64 height, uint32 index);
    event PriceUpdated(bytes32 indexed subjectId, uint256 answer, uint64 provenAtHeight);

    error SubjectInactive();
    error RuleNotAllowed(bytes32 ruleId);
    error RuleMismatch();
    error ChainKeyMismatch();
    error MalformedInput();
    error VerificationFailed();
    error AlreadyConsumed(bytes32 key);
    error ReceiptNotSuccessful(uint256 position);
    error BondTooSmall(uint256 required);
    error IncidentNotOpen();
    error ChallengeWindowOpen();
    error ChallengeWindowClosed();
    error GapNotInRange();
    error GapNotRelevant();
    error RefundFailed();

    constructor(address owner_, SubjectRegistry registry_, IUnderwritingVault vault_, uint64 challengeWindow_)
        Ownable(owner_)
    {
        VERIFIER = NativeQueryVerifierLib.getVerifier();
        REGISTRY = registry_;
        VAULT = vault_;
        challengeWindow = challengeWindow_;
    }

    function setChallengeWindow(uint64 window) external onlyOwner {
        challengeWindow = window;
    }

    // ------------------------------------------------------------ entrypoint

    /// @inheritdoc IWatchtowerCore
    function submitEvidence(EvidenceInput calldata input) external payable override returns (bytes32 incidentId) {
        Subject memory subject = _loadSubject(input);
        IConservationRule rule = IConservationRule(REGISTRY.ruleImpl(input.ruleId));

        VerifiedTx[] memory window = _verifyAndBuild(input);
        SubjectView memory state = _viewOf(input.subjectId, subject);

        EvidenceLib.enforceShape(window, rule.windowShape(), state.cursorHeight, state.cursorIndex);
        _consumeAll(input.ruleId, input.subjectId, window);

        (Verdict memory verdict, AccDelta memory delta) = rule.evaluate(input.subjectId, window, state);

        SubjectView memory snapshot = state;
        _applyDelta(input.subjectId, delta);

        (uint64 headHeight, uint32 headIndex) = window.head();
        incidentId = SubjectKey.incidentId(input.ruleId, input.subjectId, window[0].blockHeight, window[0].txIndex);

        emit EvidenceAccepted(
            input.subjectId,
            input.ruleId,
            incidentId,
            input.chainKey,
            window[0].blockHeight,
            window[0].txIndex,
            uint64(input.continuityRoots.length)
        );

        if (rule.settlement() == Settlement.INSTANT) {
            _settleInstant(incidentId, input, verdict, uint64(input.continuityRoots.length));
            _refund(msg.value);
        } else {
            _openOrAdvance(incidentId, input, verdict, snapshot, headHeight, headIndex);
        }
    }

    /// @inheritdoc IWatchtowerCore
    /// @notice Dry-run a submission with no gas and no state change, so the dashboard can show a
    ///         verdict before anyone pays for it. Uses the precompile's read-only `verify` overload.
    function previewEvidence(EvidenceInput calldata input)
        external
        view
        override
        returns (bool verified, Verdict memory verdict)
    {
        Subject memory subject = REGISTRY.getSubject(input.subjectId);
        address impl = REGISTRY.ruleImpl(input.ruleId);
        if (impl == address(0)) return (false, verdict);

        verified = _verifyView(input);
        if (!verified) return (false, verdict);

        VerifiedTx[] memory window = _buildWindow(input);
        window.sortByCoordinate();
        SubjectView memory state = _viewOf(input.subjectId, subject);
        (verdict,) = IConservationRule(impl).evaluate(input.subjectId, window, state);
    }

    // ------------------------------------------------------------ settlement

    function _settleInstant(bytes32 incidentId, EvidenceInput calldata input, Verdict memory verdict, uint64 contLen)
        private
    {
        if (!verdict.violated) return;
        Incident storage inc = incidents[incidentId];
        if (inc.status != 0) return; // already judged; window shifted or re-filed
        inc.subjectId = input.subjectId;
        inc.ruleId = input.ruleId;
        inc.prosecutor = msg.sender;
        inc.beneficiary = verdict.beneficiary;
        inc.damagesUsd = verdict.damages;
        inc.continuityLength = contLen;
        inc.status = 2;

        (uint256 paid,) =
            VAULT.settle(incidentId, input.subjectId, verdict.beneficiary, verdict.damages, msg.sender, contLen);

        emit VerdictIssued(
            incidentId, input.subjectId, input.ruleId, verdict.beneficiary, verdict.damages, paid, verdict.evidenceHash
        );
    }

    /// @dev Stream rules ingest continuously; most submissions are ordinary accumulator advances and
    ///      settle nothing. Only a violation opens a bonded, challengeable incident.
    function _openOrAdvance(
        bytes32 incidentId,
        EvidenceInput calldata input,
        Verdict memory verdict,
        SubjectView memory snapshot,
        uint64 headHeight,
        uint32 headIndex
    ) private {
        if (!verdict.violated) {
            _refund(msg.value);
            return;
        }

        Incident storage inc = incidents[incidentId];
        if (inc.status != 0) {
            _refund(msg.value);
            return;
        }

        uint256 bond = msg.value;
        uint256 required = _requiredBond();
        if (bond < required) revert BondTooSmall(required);

        inc.subjectId = input.subjectId;
        inc.ruleId = input.ruleId;
        inc.prosecutor = msg.sender;
        inc.beneficiary = verdict.beneficiary;
        inc.damagesUsd = verdict.damages;
        inc.fromHeight = snapshot.cursorHeight;
        inc.fromIndex = snapshot.cursorIndex;
        inc.toHeight = headHeight;
        inc.toIndex = headIndex;
        inc.challengeDeadline = uint64(block.timestamp) + challengeWindow;
        inc.continuityLength = uint64(input.continuityRoots.length);
        inc.snapshot = snapshot;
        inc.status = 1;

        openBreaches[input.subjectId] += 1;
        VAULT.postBond{value: bond}(incidentId, msg.sender);
        VAULT.setFrozen(input.subjectId, true);

        emit BreachOpened(incidentId, input.subjectId, verdict.damages, msg.sender, bond, inc.challengeDeadline);
    }

    /// @inheritdoc IWatchtowerCore
    /// @notice Pay an optimistic claim once its challenge window closes unchallenged.
    function settleBreach(bytes32 incidentId) external override {
        Incident storage inc = incidents[incidentId];
        if (inc.status != 1) revert IncidentNotOpen();
        if (block.timestamp < inc.challengeDeadline) revert ChallengeWindowOpen();

        inc.status = 2;
        (uint256 paid,) = VAULT.settle(
            incidentId, inc.subjectId, inc.beneficiary, inc.damagesUsd, inc.prosecutor, inc.continuityLength
        );
        VAULT.releaseBond(incidentId);
        _closeBreach(inc.subjectId);

        emit BreachSettled(incidentId, paid);
        emit VerdictIssued(incidentId, inc.subjectId, inc.ruleId, inc.beneficiary, inc.damagesUsd, paid, bytes32(0));
    }

    /// @inheritdoc IWatchtowerCore
    /// @notice Prove the prosecutor skipped a relevant transaction. You cannot prove a negative
    ///         on-chain, so completeness is secured economically instead: show one matching
    ///         transaction whose coordinate falls inside the range they claimed to have covered, and
    ///         the accumulator rolls back to its snapshot while their bond becomes yours.
    /// @dev The fraud proof is itself an ordinary verified window - a SINGLE_TX submission through
    ///      the same precompile. Watchtower's defence runs on Watchtower.
    function challengeGap(bytes32 incidentId, EvidenceInput calldata gapEvidence) external override {
        Incident storage inc = incidents[incidentId];
        if (inc.status != 1) revert IncidentNotOpen();
        if (block.timestamp >= inc.challengeDeadline) revert ChallengeWindowClosed();

        Subject memory subject = REGISTRY.getSubject(inc.subjectId);
        if (gapEvidence.chainKey != subject.chainKey) revert ChainKeyMismatch();
        if (gapEvidence.encodedTxs.length != 1) revert MalformedInput();

        VerifiedTx[] memory window = _verifyAndBuild(gapEvidence);
        VerifiedTx memory gap = window[0];

        if (!_strictlyBetween(gap.blockHeight, gap.txIndex, inc.fromHeight, inc.fromIndex, inc.toHeight, inc.toIndex)) {
            revert GapNotInRange();
        }
        if (!_touchesSubject(gap.encodedTx, subject.sourceContract)) revert GapNotRelevant();

        _consumeAll(GAP_RULE, inc.subjectId, window);

        _state[inc.subjectId] = inc.snapshot;
        inc.status = 3;

        VAULT.slashBond(incidentId, msg.sender);
        _closeBreach(inc.subjectId);

        emit GapChallengeUpheld(incidentId, msg.sender, gap.blockHeight, gap.txIndex);
        emit CursorAdvanced(inc.subjectId, inc.snapshot.cursorHeight, inc.snapshot.cursorIndex);
    }

    // -------------------------------------------------------------- internals

    function _loadSubject(EvidenceInput calldata input) private view returns (Subject memory subject) {
        subject = REGISTRY.getSubject(input.subjectId);
        if (!subject.active) revert SubjectInactive();
        if (!REGISTRY.ruleAllowed(input.ruleId)) revert RuleNotAllowed(input.ruleId);
        if (REGISTRY.ruleImpl(input.ruleId) == address(0)) revert RuleNotAllowed(input.ruleId);
        if (subject.boundRule != input.ruleId) revert RuleMismatch();
        if (subject.chainKey != input.chainKey) revert ChainKeyMismatch();
    }

    /// @dev Verification and decoding. The precompile proves inclusion and continuity; it does NOT
    ///      check whether the transaction succeeded, so every entry's receipt status is asserted here.
    ///      (`FailedTx` is the single rule that wants the inverse, and it re-checks for itself.)
    function _verifyAndBuild(EvidenceInput calldata input) private returns (VerifiedTx[] memory window) {
        _checkShape(input);

        INativeQueryVerifier.MerkleProof[] memory proofs = _merkleProofs(input);
        INativeQueryVerifier.ContinuityProof memory continuity =
            INativeQueryVerifier.ContinuityProof({lowerEndpointDigest: input.lowerEndpointDigest, roots: input.continuityRoots});

        bool ok;
        if (proofs.length == 1) {
            ok = VERIFIER.verifyAndEmit(input.chainKey, input.blockHeights[0], input.encodedTxs[0], proofs[0], continuity);
        } else {
            ok = VERIFIER.verifyAndEmit(input.chainKey, input.blockHeights, input.encodedTxs, proofs, continuity);
        }
        if (!ok) revert VerificationFailed();

        window = _buildWindow(input);
        window.sortByCoordinate();
    }

    function _verifyView(EvidenceInput calldata input) private view returns (bool) {
        if (input.encodedTxs.length == 0) return false;
        INativeQueryVerifier.MerkleProof[] memory proofs = _merkleProofs(input);
        INativeQueryVerifier.ContinuityProof memory continuity =
            INativeQueryVerifier.ContinuityProof({lowerEndpointDigest: input.lowerEndpointDigest, roots: input.continuityRoots});
        if (proofs.length == 1) {
            return VERIFIER.verify(input.chainKey, input.blockHeights[0], input.encodedTxs[0], proofs[0], continuity);
        }
        return VERIFIER.verify(input.chainKey, input.blockHeights, input.encodedTxs, proofs, continuity);
    }

    function _checkShape(EvidenceInput calldata input) private pure {
        uint256 n = input.encodedTxs.length;
        if (n == 0 || n > 10) revert MalformedInput(); // protocol batch ceiling is 10
        if (input.blockHeights.length != n || input.merkleRoots.length != n || input.siblings.length != n) {
            revert MalformedInput();
        }
    }

    function _merkleProofs(EvidenceInput calldata input)
        private
        pure
        returns (INativeQueryVerifier.MerkleProof[] memory proofs)
    {
        uint256 n = input.encodedTxs.length;
        proofs = new INativeQueryVerifier.MerkleProof[](n);
        for (uint256 i; i < n; ++i) {
            proofs[i] = INativeQueryVerifier.MerkleProof({root: input.merkleRoots[i], siblings: input.siblings[i]});
        }
    }

    /// @dev The transaction's position inside its block comes from the precompile itself
    ///      (`calculateTxIndex`), not from arithmetic of ours. That coordinate is the whole thesis:
    ///      an Ethereum contract cannot see where it sits among its neighbours; a Creditcoin
    ///      contract can.
    function _buildWindow(EvidenceInput calldata input) private view returns (VerifiedTx[] memory window) {
        uint256 n = input.encodedTxs.length;
        window = new VerifiedTx[](n);
        INativeQueryVerifier.MerkleProof[] memory proofs = _merkleProofs(input);

        for (uint256 i; i < n; ++i) {
            uint32 txIndex = uint32(VERIFIER.calculateTxIndex(proofs[i]));
            EvmV1Decoder.CommonTxFields memory common = EvmV1Decoder.decodeCommonTxFields(input.encodedTxs[i]);
            EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(input.encodedTxs[i]);

            window[i] = VerifiedTx({
                chainKey: input.chainKey,
                blockHeight: input.blockHeights[i],
                txIndex: txIndex,
                from: common.from,
                to: common.toIsNull ? address(0) : common.to,
                success: receipt.receiptStatus == 1,
                encodedTx: input.encodedTxs[i]
            });
        }
    }

    function _consumeAll(bytes32 ruleId, bytes32 subjectId, VerifiedTx[] memory window) private {
        for (uint256 i; i < window.length; ++i) {
            bytes32 key =
                SubjectKey.evidenceKey(ruleId, subjectId, window[i].chainKey, window[i].blockHeight, window[i].txIndex);
            if (consumed[key]) revert AlreadyConsumed(key);
            consumed[key] = true;
        }
    }

    function _viewOf(bytes32 subjectId, Subject memory subject) private view returns (SubjectView memory v) {
        v = _state[subjectId];
        if (!_anchored[subjectId]) {
            v.cursorHeight = subject.anchorHeight;
            v.cursorIndex = subject.anchorIndex;
        }
    }

    function _applyDelta(bytes32 subjectId, AccDelta memory delta) private {
        SubjectView storage s = _state[subjectId];
        if (delta.lockedDelta != 0) s.locked = _applySigned(s.locked, delta.lockedDelta);
        if (delta.mintedDelta != 0) s.minted = _applySigned(s.minted, delta.mintedDelta);
        if (delta.price != 0) {
            s.price = delta.price;
            _priceHeight[subjectId] = delta.newHeight;
            emit PriceUpdated(subjectId, delta.price, delta.newHeight);
        }
        if (delta.newHeight != 0) {
            s.cursorHeight = delta.newHeight;
            s.cursorIndex = delta.newIndex;
            _anchored[subjectId] = true;
            emit CursorAdvanced(subjectId, delta.newHeight, delta.newIndex);
        }
    }

    function _applySigned(uint256 base, int256 delta) private pure returns (uint256) {
        if (delta >= 0) return base + uint256(delta);
        uint256 magnitude = uint256(-delta);
        return magnitude >= base ? 0 : base - magnitude;
    }

    /// @dev A challenged transaction only counts if it actually touches the subject being watched.
    function _touchesSubject(bytes memory encodedTx, address sourceContract) private pure returns (bool) {
        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTx);
        for (uint256 i; i < receipt.receiptLogs.length; ++i) {
            if (receipt.receiptLogs[i].address_ == sourceContract) return true;
        }
        return false;
    }

    function _strictlyBetween(
        uint64 h,
        uint32 i,
        uint64 lowH,
        uint32 lowI,
        uint64 highH,
        uint32 highI
    ) private pure returns (bool) {
        bool afterLow = h > lowH || (h == lowH && i > lowI);
        bool beforeHigh = h < highH || (h == highH && i < highI);
        return afterLow && beforeHigh;
    }

    /// @dev Thaw the tranche only once nothing is left in dispute.
    function _closeBreach(bytes32 subjectId) private {
        uint256 remaining = openBreaches[subjectId];
        if (remaining > 0) {
            remaining -= 1;
            openBreaches[subjectId] = remaining;
        }
        if (remaining == 0) VAULT.setFrozen(subjectId, false);
    }

    function _requiredBond() private view returns (uint256) {
        (bool ok, bytes memory data) = address(VAULT).staticcall(abi.encodeWithSignature("requiredBond()"));
        if (!ok || data.length < 32) return 0;
        return abi.decode(data, (uint256));
    }

    function _refund(uint256 amount) private {
        if (amount == 0) return;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert RefundFailed();
    }

    // ------------------------------------------------------------- read side

    /// @inheritdoc IAttestedFeed
    /// @dev Before a subject's first ingestion the honest answer is its anchor, not zero: the anchor
    ///      is the coordinate the stream is declared to start from, and it is exactly the cursor the
    ///      core will enforce against the first submission. Reporting zero would tell a consumer that
    ///      nothing has been verified below block zero, which is true but useless.
    function latestProvenHead(bytes32 subjectId) external view override returns (uint64 height, uint32 index) {
        SubjectView memory v = _publicView(subjectId);
        return (v.cursorHeight, v.cursorIndex);
    }

    /// @inheritdoc IAttestedFeed
    function reserves(bytes32 subjectId) external view override returns (uint256 locked, uint256 minted) {
        SubjectView memory v = _state[subjectId];
        return (v.locked, v.minted);
    }

    /// @inheritdoc IAttestedFeed
    function price(bytes32 subjectId) external view override returns (uint256 answer, uint64 provenAtHeight) {
        return (_state[subjectId].price, _priceHeight[subjectId]);
    }

    /// @notice Whole accumulator for a subject - one call, everything the dashboard needs.
    /// @dev Reports the same cursor a rule would be handed, anchor included, so the dashboard and the
    ///      judgement never disagree about where the proven head sits.
    function stateOf(bytes32 subjectId) external view returns (SubjectView memory) {
        return _publicView(subjectId);
    }

    /// @dev `_viewOf` needs a loaded Subject; this is the read-side equivalent for callers who only
    ///      have an id, and tolerates ids that were never registered.
    function _publicView(bytes32 subjectId) private view returns (SubjectView memory v) {
        v = _state[subjectId];
        if (_anchored[subjectId] || !REGISTRY.exists(subjectId)) return v;
        Subject memory subject = REGISTRY.getSubject(subjectId);
        v.cursorHeight = subject.anchorHeight;
        v.cursorIndex = subject.anchorIndex;
    }

    function incidentOf(bytes32 incidentId) external view returns (Incident memory) {
        return incidents[incidentId];
    }

    receive() external payable {}
}
