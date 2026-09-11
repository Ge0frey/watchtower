// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Base} from "../Base.t.sol";
import {EvidenceInput} from "../../src/interfaces/IWatchtowerCore.sol";
import {Incident, WatchtowerCore} from "../../src/core/WatchtowerCore.sol";
import {EvidenceLib} from "../../src/libs/EvidenceLib.sol";
import {TxFixture} from "../TxFixture.sol";

/// @notice Rebuilding a custodian's balance sheet from proven events, and catching it over-issuing.
contract ReserveConservationTest is Base {
    uint256 internal constant PRICE_E8 = 3400e8;

    /// @dev Cached because `makeAddr` calls a cheatcode, which would make the builders non-view -
    ///      and, more importantly, would consume a pending `vm.prank` during argument evaluation.
    address internal bridgeUser = bridgeUser;
    address internal impostorContract = impostorContract;

    function setUp() public override {
        super.setUp();
        seedPrice(feedSubject, PRICE_E8, 2001, 12);

        vm.deal(holder, 10 ether);
        vm.prank(holder);
        vault.buyCover{value: 1 ether}(bridgeSubject, 100e8, 30 days);
    }

    function _custodianTx(string memory signature, uint256 amount) internal view returns (bytes memory) {
        return TxFixture.legacy(
            bridgeUser,
            bridge,
            0,
            1,
            90000,
            15 gwei,
            TxFixture.logs1(TxFixture.amountLog(bridge, signature, bridgeUser, amount))
        );
    }

    function _ingest(string memory signature, uint256 amount, uint64 height, uint32 index)
        internal
        returns (bytes32)
    {
        EvidenceInput memory input = singleEvidence(
            bridgeSubject, reserve.ruleId(), SEPOLIA, height, index, _custodianTx(signature, amount), 10
        );
        vm.prank(prosecutor);
        return core.submitEvidence(input);
    }

    /// @notice The protocol proves transactions, not state - so the balance sheet is replayed.
    function test_accumulatesReservesFromProvenEvents() public {
        _ingest("Locked(address,uint256)", 10 ether, 1001, 3);
        _ingest("Minted(address,uint256)", 4 ether, 1002, 1);

        (uint256 locked, uint256 minted) = core.reserves(bridgeSubject);
        assertEq(locked, 10 ether);
        assertEq(minted, 4 ether);

        (uint64 height, uint32 index) = core.latestProvenHead(bridgeSubject);
        assertEq(height, 1002, "proven head follows the evidence");
        assertEq(index, 1);
    }

    function test_burnAndUnlockReduceTheLedger() public {
        _ingest("Locked(address,uint256)", 10 ether, 1001, 3);
        _ingest("Minted(address,uint256)", 8 ether, 1002, 1);
        _ingest("Burned(address,uint256)", 3 ether, 1003, 0);
        _ingest("Unlocked(address,uint256)", 2 ether, 1004, 7);

        (uint256 locked, uint256 minted) = core.reserves(bridgeSubject);
        assertEq(locked, 8 ether);
        assertEq(minted, 5 ether);
    }

    /// @notice A stream cannot rewind. Re-ingesting old evidence is a cursor regression, not a claim.
    function test_streamRefusesToRewind() public {
        _ingest("Locked(address,uint256)", 10 ether, 1005, 2);

        EvidenceInput memory input = singleEvidence(
            bridgeSubject,
            reserve.ruleId(),
            SEPOLIA,
            1004,
            9,
            _custodianTx("Locked(address,uint256)", 1 ether),
            10
        );
        vm.prank(prosecutor);
        vm.expectRevert(EvidenceLib.CursorRegression.selector);
        core.submitEvidence(input);
    }

    /// @notice Over-issuance opens a bonded, challengeable claim rather than paying immediately.
    function test_breachOpensOptimisticallyAndSettlesAfterWindow() public {
        _ingest("Locked(address,uint256)", 10 ether, 1001, 3);

        bytes memory overMint = _custodianTx("Minted(address,uint256)", 10.01 ether);
        EvidenceInput memory input =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, 1002, 1, overMint, 10);

        vm.prank(prosecutor);
        bytes32 incidentId = core.submitEvidence{value: 0.1 ether}(input);

        Incident memory inc = core.incidentOf(incidentId);
        assertEq(uint256(inc.status), 1, "open, not settled");
        assertEq(inc.damagesUsd, 34e8, "0.01 ETH shortfall at $3,400");
        assertTrue(vault.frozen(bridgeSubject), "underwriters cannot exit mid-breach");

        // Nobody may settle early.
        vm.expectRevert(WatchtowerCore.ChallengeWindowOpen.selector);
        core.settleBreach(incidentId);

        uint256 holderBefore = holder.balance;
        vm.warp(block.timestamp + 11 minutes);
        core.settleBreach(incidentId);

        assertEq(holder.balance - holderBefore, 34 ether, "cover holder paid");
        assertEq(uint256(core.incidentOf(incidentId).status), 2);
        assertFalse(vault.frozen(bridgeSubject), "subject thawed");
    }

    /// @notice Underwriters are locked in from the moment a breach is proven until it resolves.
    function test_unstakeBlockedWhileBreachOpen() public {
        _ingest("Locked(address,uint256)", 10 ether, 1001, 3);

        bytes memory overMint = _custodianTx("Minted(address,uint256)", 11 ether);
        EvidenceInput memory input =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, 1002, 1, overMint, 10);
        vm.prank(prosecutor);
        core.submitEvidence{value: 0.1 ether}(input);

        vm.prank(underwriter);
        vm.expectRevert(abi.encodeWithSignature("SubjectFrozen()"));
        vault.unstake(bridgeSubject, 1 ether);
    }

    /// @notice A bond is the price of making a claim that cannot verify itself.
    function test_breachRequiresBond() public {
        _ingest("Locked(address,uint256)", 1 ether, 1001, 3);

        bytes memory overMint = _custodianTx("Minted(address,uint256)", 2 ether);
        EvidenceInput memory input =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, 1002, 1, overMint, 10);

        vm.prank(prosecutor);
        vm.expectRevert(abi.encodeWithSelector(WatchtowerCore.BondTooSmall.selector, 0.1 ether));
        core.submitEvidence{value: 0.01 ether}(input);
    }

    /// @notice Look-alike events from another contract in the same transaction are not evidence.
    function test_ignoresEventsFromOtherContracts() public {
        bytes memory impostor = TxFixture.legacy(
            bridgeUser,
            bridge,
            0,
            1,
            90000,
            15 gwei,
            TxFixture.logs1(
                TxFixture.amountLog(impostorContract, "Locked(address,uint256)", bridgeUser, 99 ether)
            )
        );
        EvidenceInput memory input =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, 1001, 1, impostor, 10);
        vm.prank(prosecutor);
        core.submitEvidence(input);

        (uint256 locked,) = core.reserves(bridgeSubject);
        assertEq(locked, 0, "only the custodian's own events count");
    }

    /// @notice A stream can break twice before anybody settles the first claim. Settling one must
    ///         not open an exit for underwriters while the other is still in dispute.
    function test_secondBreachKeepsTheTrancheFrozen() public {
        _ingest("Locked(address,uint256)", 10 ether, 1001, 3);

        bytes memory firstOverMint = _custodianTx("Minted(address,uint256)", 11 ether);
        EvidenceInput memory first =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, 1002, 1, firstOverMint, 10);
        vm.prank(prosecutor);
        bytes32 firstIncident = core.submitEvidence{value: 0.1 ether}(first);

        bytes memory secondOverMint = _custodianTx("Minted(address,uint256)", 1 ether);
        EvidenceInput memory second =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, 1003, 0, secondOverMint, 10);
        vm.prank(prosecutor);
        bytes32 secondIncident = core.submitEvidence{value: 0.1 ether}(second);

        assertEq(core.openBreaches(bridgeSubject), 2);

        vm.warp(block.timestamp + 11 minutes);
        core.settleBreach(firstIncident);

        assertEq(core.openBreaches(bridgeSubject), 1);
        assertTrue(vault.frozen(bridgeSubject), "one claim paid, one still in dispute");

        vm.prank(underwriter);
        vm.expectRevert(abi.encodeWithSignature("SubjectFrozen()"));
        vault.unstake(bridgeSubject, 1 ether);

        core.settleBreach(secondIncident);
        assertEq(core.openBreaches(bridgeSubject), 0);
        assertFalse(vault.frozen(bridgeSubject), "nothing left in dispute");
    }

    /// @notice Before the first ingestion the proven head is the subject's anchor, not zero - it is
    ///         the coordinate the core will actually enforce against the first submission.
    function test_provenHeadStartsAtTheAnchor() public view {
        (uint64 height, uint32 index) = core.latestProvenHead(bridgeSubject);
        assertEq(height, 1000, "DemoBridge anchor");
        assertEq(index, 0);
        assertEq(core.stateOf(bridgeSubject).cursorHeight, 1000, "the dashboard reads the same cursor");
    }

    /// @notice A batch is capped at 10 transactions sharing one continuity proof.
    function test_batchOfTenIsAccepted() public {
        uint64[] memory heights = new uint64[](10);
        uint32[] memory indices = new uint32[](10);
        bytes[] memory txs = new bytes[](10);
        for (uint256 i; i < 10; ++i) {
            heights[i] = uint64(1010 + i);
            indices[i] = uint32(i);
            txs[i] = _custodianTx("Locked(address,uint256)", 1 ether);
        }

        EvidenceInput memory input =
            evidence(bridgeSubject, reserve.ruleId(), SEPOLIA, heights, indices, txs, 10);
        vm.prank(prosecutor);
        core.submitEvidence(input);

        (uint256 locked,) = core.reserves(bridgeSubject);
        assertEq(locked, 10 ether);
    }
}
