// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Base} from "../Base.t.sol";
import {Incident, WatchtowerCore} from "../../src/core/WatchtowerCore.sol";
import {EvidenceInput} from "../../src/interfaces/IWatchtowerCore.sol";
import {TxFixture} from "../TxFixture.sol";

/// @notice The honest half of the design.
///
/// @dev You cannot prove a negative on-chain. A sandwich claim carries all of its own evidence, but a
///      solvency claim depends on completeness - on nothing relevant having been skipped - and no
///      proof system can demonstrate an absence. Watchtower does not paper over that: stream claims
///      are bonded and challengeable, and the challenge is itself an ordinary verified window.
///      The fraud proof runs on the same engine it defends.
contract GapChallengeTest is Base {
    address internal bridgeUser = makeAddr("bridgeUser");

    uint64 internal constant LOCK_HEIGHT = 1002;
    uint32 internal constant LOCK_INDEX = 1;
    uint64 internal constant MINT_HEIGHT = 1005;
    uint32 internal constant MINT_INDEX = 3;

    bytes32 internal incidentId;

    function setUp() public override {
        super.setUp();
        seedPrice(feedSubject, 3400e8, 2001, 12);

        vm.deal(holder, 10 ether);
        vm.prank(holder);
        vault.buyCover{value: 1 ether}(bridgeSubject, 100e8, 30 days);

        // A dishonest prosecutor ingests only the mint, skipping the lock that backs it, so the
        // accumulator shows liabilities with no collateral behind them.
        EvidenceInput memory input = singleEvidence(
            bridgeSubject,
            reserve.ruleId(),
            SEPOLIA,
            MINT_HEIGHT,
            MINT_INDEX,
            _custodianTx("Minted(address,uint256)", 5 ether),
            10
        );
        vm.prank(prosecutor);
        incidentId = core.submitEvidence{value: 0.1 ether}(input);
    }

    function _custodianTx(string memory signature, uint256 amount) internal view returns (bytes memory) {
        return TxFixture.legacy(
            bridgeUser, bridge, 0, 1, 90000, 15 gwei,
            TxFixture.logs1(TxFixture.amountLog(bridge, signature, bridgeUser, amount))
        );
    }

    function _gapEvidence(uint64 height, uint32 index, string memory signature)
        internal
        view
        returns (EvidenceInput memory)
    {
        return singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, height, index, _custodianTx(signature, 9 ether), 10);
    }

    function test_breachIsOpenBeforeChallenge() public view {
        Incident memory inc = core.incidentOf(incidentId);
        assertEq(uint256(inc.status), 1);
        assertEq(inc.fromHeight, 1000, "snapshot cursor is the subject anchor");
        assertEq(inc.toHeight, MINT_HEIGHT);
        (, uint256 minted) = core.reserves(bridgeSubject);
        assertEq(minted, 5 ether);
    }

    /// @notice Show one skipped transaction inside the claimed range and the whole claim unwinds.
    function test_gapChallengeRollsBackAndSlashes() public {
        uint256 challengerBefore = challenger.balance;

        EvidenceInput memory gap = _gapEvidence(LOCK_HEIGHT, LOCK_INDEX, "Locked(address,uint256)");
        vm.prank(challenger);
        core.challengeGap(incidentId, gap);

        Incident memory inc = core.incidentOf(incidentId);
        assertEq(uint256(inc.status), 3, "rolled back");

        (uint256 locked, uint256 minted) = core.reserves(bridgeSubject);
        assertEq(locked, 0, "accumulator restored to its snapshot");
        assertEq(minted, 0, "the skipped-evidence claim is erased");

        (uint64 height,) = core.latestProvenHead(bridgeSubject);
        assertEq(height, 1000, "cursor back at the anchor");

        assertEq(challenger.balance - challengerBefore, 0.1 ether, "bond slashed to the challenger");
        assertFalse(vault.frozen(bridgeSubject), "subject thawed");
    }

    /// @notice A settled claim cannot be paid after it has been overturned.
    function test_rolledBackBreachCannotSettle() public {
        EvidenceInput memory gap = _gapEvidence(LOCK_HEIGHT, LOCK_INDEX, "Locked(address,uint256)");
        vm.prank(challenger);
        core.challengeGap(incidentId, gap);

        vm.warp(block.timestamp + 11 minutes);
        vm.expectRevert(WatchtowerCore.IncidentNotOpen.selector);
        core.settleBreach(incidentId);
    }

    /// @notice Evidence from outside the claimed range proves nothing about this claim.
    function test_rejectsEvidenceOutsideTheClaimedRange() public {
        EvidenceInput memory gap = _gapEvidence(1008, 0, "Locked(address,uint256)"); // after the head
        vm.prank(challenger);
        vm.expectRevert(WatchtowerCore.GapNotInRange.selector);
        core.challengeGap(incidentId, gap);
    }

    /// @notice A transaction that never touched the custodian is not a gap in its stream.
    function test_rejectsIrrelevantEvidence() public {
        bytes memory unrelated = TxFixture.legacy(
            bridgeUser, makeAddr("someDex"), 0, 1, 50000, 10 gwei,
            TxFixture.logs1(TxFixture.amountLog(makeAddr("someDex"), "Locked(address,uint256)", bridgeUser, 1 ether))
        );
        EvidenceInput memory gap =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, LOCK_HEIGHT, LOCK_INDEX, unrelated, 10);

        vm.prank(challenger);
        vm.expectRevert(WatchtowerCore.GapNotRelevant.selector);
        core.challengeGap(incidentId, gap);
    }

    /// @notice Once the window closes the claim is final; the time to object has passed.
    function test_challengeWindowExpires() public {
        vm.warp(block.timestamp + 11 minutes);
        EvidenceInput memory gap = _gapEvidence(LOCK_HEIGHT, LOCK_INDEX, "Locked(address,uint256)");
        vm.prank(challenger);
        vm.expectRevert(WatchtowerCore.ChallengeWindowClosed.selector);
        core.challengeGap(incidentId, gap);
    }

    /// @notice The replay guard is rule-scoped, which is what lets one transaction be evidence twice:
    ///         once for the stream it belongs to, and once as the proof that the stream skipped it.
    function test_sameTransactionServesStreamAndChallenge() public {
        EvidenceInput memory gap = _gapEvidence(LOCK_HEIGHT, LOCK_INDEX, "Locked(address,uint256)");
        vm.prank(challenger);
        core.challengeGap(incidentId, gap);

        // The very same coordinate is now ingested honestly under the stream rule.
        EvidenceInput memory input = singleEvidence(
            bridgeSubject, reserve.ruleId(), SEPOLIA, LOCK_HEIGHT, LOCK_INDEX,
            _custodianTx("Locked(address,uint256)", 9 ether), 10
        );
        vm.prank(prosecutor);
        core.submitEvidence(input);

        (uint256 locked,) = core.reserves(bridgeSubject);
        assertEq(locked, 9 ether, "a global replay guard would have made this impossible");
    }
}
