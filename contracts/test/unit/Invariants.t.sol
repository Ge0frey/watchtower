// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Base} from "../Base.t.sol";
import {EvidenceInput} from "../../src/interfaces/IWatchtowerCore.sol";
import {WatchtowerCore} from "../../src/core/WatchtowerCore.sol";
import {EvidenceLib} from "../../src/libs/EvidenceLib.sol";
import {TxFixture} from "../TxFixture.sol";

/// @notice The four properties the whole design rests on, fuzzed rather than sampled.
///
/// @dev Every other test picks coordinates a human chose. These pick coordinates the fuzzer chose,
///      which is the only way to be confident that the ordering rules hold at the edges - a window
///      that wraps, an index at the top of the tree, a cursor one position behind the evidence.
contract InvariantsTest is Base {
    uint256 internal constant PRICE_E8 = 3400e8;

    function setUp() public override {
        super.setUp();
        seedPrice(feedSubject, PRICE_E8, 2001, 12);
        vm.deal(holder, 100 ether);
        vm.prank(holder);
        vault.buyCover{value: 10 ether}(bridgeSubject, 1000e8, 30 days);
    }

    function _lockTx(uint256 amount) internal view returns (bytes memory) {
        return TxFixture.legacy(
            makeAddrCached(),
            bridge,
            0,
            1,
            90000,
            15 gwei,
            TxFixture.logs1(TxFixture.amountLog(bridge, "Locked(address,uint256)", bridge, amount))
        );
    }

    /// @dev `makeAddr` is a cheatcode; calling it while a prank is pending would consume the prank.
    function makeAddrCached() internal pure returns (address) {
        return address(0xA11CE);
    }

    // -------------------------------------------------- 1. the cursor never regresses

    /// @notice Whatever coordinates a prosecutor submits, the stored cursor only ever moves forward.
    function testFuzz_cursorNeverRegresses(uint64 heightA, uint32 indexA, uint64 heightB, uint32 indexB) public {
        heightA = uint64(bound(heightA, 1001, 1_000_000));
        heightB = uint64(bound(heightB, 1001, 1_000_000));
        indexA = uint32(bound(indexA, 0, 4095));
        indexB = uint32(bound(indexB, 0, 4095));

        EvidenceInput memory first =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, heightA, indexA, _lockTx(1 ether), 10);
        vm.prank(prosecutor);
        core.submitEvidence(first);

        (uint64 afterFirstHeight, uint32 afterFirstIndex) = core.latestProvenHead(bridgeSubject);
        assertEq(afterFirstHeight, heightA);

        EvidenceInput memory second =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, heightB, indexB, _lockTx(1 ether), 10);

        bool forward = heightB > heightA || (heightB == heightA && indexB > indexA);
        vm.prank(prosecutor);
        if (!forward) {
            vm.expectRevert(EvidenceLib.CursorRegression.selector);
            core.submitEvidence(second);
        } else {
            core.submitEvidence(second);
        }

        (uint64 finalHeight, uint32 finalIndex) = core.latestProvenHead(bridgeSubject);
        assertTrue(
            finalHeight > afterFirstHeight || (finalHeight == afterFirstHeight && finalIndex >= afterFirstIndex),
            "the cursor moved backwards"
        );
    }

    // ------------------------------------------- 2. evidence is never consumed twice

    /// @notice The same coordinate cannot be filed twice under one rule, whatever the coordinate.
    function testFuzz_evidenceIsNeverConsumedTwice(uint64 height, uint32 index) public {
        height = uint64(bound(height, 1001, 1_000_000));
        index = uint32(bound(index, 0, 4095));

        EvidenceInput memory input =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, height, index, _lockTx(1 ether), 10);
        vm.prank(prosecutor);
        core.submitEvidence(input);

        // Re-filing is caught before anything is judged - by the cursor here, by the replay guard
        // when the cursor has already moved past. Either way it never applies a second time.
        vm.prank(prosecutor);
        vm.expectRevert();
        core.submitEvidence(input);

        (uint256 locked,) = core.reserves(bridgeSubject);
        assertEq(locked, 1 ether, "the accumulator moved exactly once");
    }

    /// @notice The guard is rule-scoped: the same transaction may be evidence under another rule.
    function testFuzz_replayGuardIsScopedPerRule(uint64 height, uint32 index) public {
        height = uint64(bound(height, 1001, 1_000_000));
        index = uint32(bound(index, 0, 4095));

        bytes32 streamKey = keccak256(abi.encode(reserve.ruleId(), bridgeSubject, SEPOLIA, height, index));
        bytes32 gapKey = keccak256(abi.encode(core.GAP_RULE(), bridgeSubject, SEPOLIA, height, index));

        EvidenceInput memory input =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, height, index, _lockTx(1 ether), 10);
        vm.prank(prosecutor);
        core.submitEvidence(input);

        assertTrue(core.consumed(streamKey), "consumed under the stream rule");
        assertFalse(core.consumed(gapKey), "still available as gap-challenge evidence");
    }

    // --------------------------------------- 3. payouts never exceed the per-block cap

    /// @notice Whatever a rule judges, the vault never pays more in one block than the registry's cap.
    function testFuzz_payoutNeverExceedsTheBlockCap(uint256 capCtc, uint256 shortfall) public {
        capCtc = bound(capCtc, 0.1 ether, 50 ether);
        shortfall = bound(shortfall, 0.001 ether, 20 ether);

        vm.prank(owner);
        registry.setPayoutCap(bridgeSubject, capCtc);

        EvidenceInput memory lockInput =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, 1001, 0, _lockTx(1 ether), 10);
        vm.prank(prosecutor);
        core.submitEvidence(lockInput);

        bytes memory overMint = TxFixture.legacy(
            makeAddrCached(),
            bridge,
            0,
            1,
            90000,
            15 gwei,
            TxFixture.logs1(TxFixture.amountLog(bridge, "Minted(address,uint256)", bridge, 1 ether + shortfall))
        );
        EvidenceInput memory breach =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, 1002, 0, overMint, 10);

        vm.prank(prosecutor);
        bytes32 incidentId = core.submitEvidence{value: 0.1 ether}(breach);

        uint256 before = holder.balance;
        vm.warp(block.timestamp + 11 minutes);
        core.settleBreach(incidentId);

        assertLe(holder.balance - before, capCtc, "paid more than the per-block cap allows");
    }

    // ----------------------------------- 4. the tranche always covers what it paid out

    /// @notice A payout never exceeds the capital backing the subject, so the tranche can never be
    ///         driven negative by a rule - however large the damages it returns.
    function testFuzz_payoutNeverExceedsTheTranche(uint256 shortfall) public {
        shortfall = bound(shortfall, 1 ether, 10_000 ether);

        vm.prank(owner);
        registry.setPayoutCap(bridgeSubject, type(uint128).max);

        uint256 stakedBefore = vault.trancheOf(bridgeSubject).staked;

        EvidenceInput memory lockInput =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, 1001, 0, _lockTx(1 ether), 10);
        vm.prank(prosecutor);
        core.submitEvidence(lockInput);

        bytes memory overMint = TxFixture.legacy(
            makeAddrCached(),
            bridge,
            0,
            1,
            90000,
            15 gwei,
            TxFixture.logs1(TxFixture.amountLog(bridge, "Minted(address,uint256)", bridge, 1 ether + shortfall))
        );
        EvidenceInput memory breach =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, 1002, 0, overMint, 10);

        vm.prank(prosecutor);
        bytes32 incidentId = core.submitEvidence{value: 0.1 ether}(breach);
        vm.warp(block.timestamp + 11 minutes);
        core.settleBreach(incidentId);

        uint256 tranche = vault.trancheOf(bridgeSubject).staked;
        assertLe(vault.trancheOf(bridgeSubject).paidOut, stakedBefore, "paid out more than was ever staked");
        assertEq(tranche + vault.trancheOf(bridgeSubject).paidOut, stakedBefore, "capital is conserved");
    }
}
