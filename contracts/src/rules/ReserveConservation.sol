// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";
import {IAttestedFeed} from "../interfaces/IAttestedFeed.sol";
import {IConservationRule} from "../interfaces/IConservationRule.sol";
import {PriceLib} from "../libs/PriceLib.sol";
import {EvidenceLib} from "../libs/EvidenceLib.sol";
import {SwapMath} from "../libs/SwapMath.sol";
import {Subject, SubjectRegistry} from "../core/SubjectRegistry.sol";
import {AccDelta, Settlement, SubjectView, Verdict, VerifiedTx, WindowShape} from "../types/Types.sol";

/// @title ReserveConservation
/// @notice Proves a custodian has minted more than it has locked.
///
/// @dev Where the sandwich rule reads sideways across one block, this one reads forward across many.
///      Each proven transaction moves the accumulator; the invariant is simply `minted <= locked`.
///      Because the protocol proves transactions rather than account state, there is no balance to
///      read - the balance sheet is rebuilt from a proven, gap-checked event stream anchored at a
///      known coordinate.
///
///      Settles OPTIMISTIC. A stream claim depends on completeness, and no proof system can show an
///      absence, so the claim is bonded and challengeable instead of instant. That asymmetry is
///      stated rather than hidden: see WatchtowerCore.challengeGap.
contract ReserveConservation is IConservationRule {
    /// @dev Event signatures, computed at compile time from their literals.
    bytes32 internal constant LOCKED = keccak256("Locked(address,uint256)");
    bytes32 internal constant UNLOCKED = keccak256("Unlocked(address,uint256)");
    bytes32 internal constant MINTED = keccak256("Minted(address,uint256)");
    bytes32 internal constant BURNED = keccak256("Burned(address,uint256)");

    SubjectRegistry public immutable REGISTRY;
    IAttestedFeed public immutable FEED_SOURCE;
    uint8 public immutable TOKEN_DECIMALS;

    constructor(SubjectRegistry registry_, IAttestedFeed feedSource_, uint8 tokenDecimals_) {
        REGISTRY = registry_;
        FEED_SOURCE = feedSource_;
        TOKEN_DECIMALS = tokenDecimals_;
    }

    function ruleId() external pure override returns (bytes32) {
        return keccak256("watchtower.rule.reserve-conservation.v1");
    }

    function windowShape() external pure override returns (WindowShape) {
        return WindowShape.SEQUENTIAL_STREAM;
    }

    function settlement() external pure override returns (Settlement) {
        return Settlement.OPTIMISTIC;
    }

    function name() external pure override returns (string memory) {
        return "ReserveConservation";
    }

    /// @inheritdoc IConservationRule
    function evaluate(bytes32 subjectId, VerifiedTx[] calldata window, SubjectView calldata state)
        external
        view
        override
        returns (Verdict memory verdict, AccDelta memory delta)
    {
        Subject memory subject = REGISTRY.getSubject(subjectId);
        address custodian = subject.sourceContract;

        uint256 lockedIn;
        uint256 lockedOut;
        uint256 mintedIn;
        uint256 mintedOut;

        for (uint256 i; i < window.length; ++i) {
            if (!window[i].success) continue; // the precompile does not check status; we do
            (uint256 l, uint256 u, uint256 m, uint256 b) = _tally(window[i].encodedTx, custodian);
            lockedIn += l;
            lockedOut += u;
            mintedIn += m;
            mintedOut += b;
        }

        delta.lockedDelta = int256(lockedIn) - int256(lockedOut);
        delta.mintedDelta = int256(mintedIn) - int256(mintedOut);
        (delta.newHeight, delta.newIndex) = _head(window);

        uint256 locked = _apply(state.locked, delta.lockedDelta);
        uint256 minted = _apply(state.minted, delta.mintedDelta);

        if (minted > locked) {
            uint256 shortfall = minted - locked;
            verdict = Verdict({
                violated: true,
                beneficiary: address(0), // the vault pays the subject's cover holder
                damages: SwapMath.toUsdE8(shortfall, PriceLib.resolve(FEED_SOURCE, subject, state), TOKEN_DECIMALS),
                evidenceHash: _fingerprint(window)
            });
        }
    }

    /// @dev Only logs emitted by the custodian itself count. A look-alike event from another
    ///      contract in the same transaction is ignored.
    function _tally(bytes memory encodedTx, address custodian)
        private
        pure
        returns (uint256 locked, uint256 unlocked, uint256 minted, uint256 burned)
    {
        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTx);
        EvmV1Decoder.LogEntry[] memory logs = receipt.receiptLogs;

        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].address_ != custodian) continue;
            if (logs[i].topics.length == 0 || logs[i].data.length < 32) continue;

            bytes32 sig = logs[i].topics[0];
            uint256 amount = abi.decode(logs[i].data, (uint256));

            if (sig == LOCKED) locked += amount;
            else if (sig == UNLOCKED) unlocked += amount;
            else if (sig == MINTED) minted += amount;
            else if (sig == BURNED) burned += amount;
        }
    }

    function _apply(uint256 base, int256 d) private pure returns (uint256) {
        if (d >= 0) return base + uint256(d);
        uint256 magnitude = uint256(-d);
        return magnitude >= base ? 0 : base - magnitude;
    }

    function _head(VerifiedTx[] calldata window) private pure returns (uint64 height, uint32 index) {
        VerifiedTx calldata last = window[window.length - 1];
        return (last.blockHeight, last.txIndex);
    }

    function _fingerprint(VerifiedTx[] calldata window) private pure returns (bytes32) {
        VerifiedTx[] memory copy = window;
        return EvidenceLib.fingerprint(copy);
    }
}
