// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Base} from "../Base.t.sol";
import {EvidenceInput} from "../../src/interfaces/IWatchtowerCore.sol";
import {UnderwritingVault} from "../../src/core/UnderwritingVault.sol";
import {TxFixture} from "../TxFixture.sol";

/// @notice Cover, capital and the three bounds on every payout.
contract UnderwritingVaultTest is Base {
    function setUp() public override {
        super.setUp();
        seedPrice(feedSubject, 3400e8, 2001, 12);
        vm.deal(victim, 100 ether);
    }

    function test_premiumIsOnePercentPerThirtyDays() public {
        vm.prank(victim);
        vm.expectRevert(abi.encodeWithSelector(UnderwritingVault.PremiumTooLow.selector, 1 ether));
        vault.buyCover{value: 0.9 ether}(poolSubject, 100e8, 30 days);

        vm.prank(victim);
        vault.buyCover{value: 1 ether}(poolSubject, 100e8, 30 days);
        assertEq(vault.coverOf(poolSubject, victim), 100e8);
    }

    function test_coverExpires() public {
        vm.prank(victim);
        vault.buyCover{value: 1 ether}(poolSubject, 100e8, 30 days);

        vm.warp(block.timestamp + 31 days);
        assertEq(vault.coverOf(poolSubject, victim), 0, "lapsed cover pays nothing");
    }

    function test_stakeAndUnstake() public {
        uint256 before = underwriter.balance;
        vm.prank(underwriter);
        vault.unstake(poolSubject, 50 ether);
        assertEq(underwriter.balance - before, 50 ether);
        assertEq(vault.trancheOf(poolSubject).staked, 150 ether);
    }

    function test_cannotUnstakeMoreThanStaked() public {
        vm.prank(underwriter);
        vm.expectRevert(UnderwritingVault.InsufficientStake.selector);
        vault.unstake(poolSubject, 500 ether);
    }

    /// @notice Anyone can put a bounty on any contract - that is what makes prosecutors a market
    ///         rather than a diagram.
    function test_anyoneCanFundAWatch() public {
        address stranger = makeAddr("stranger");
        vm.deal(stranger, 5 ether);
        uint256 before = vault.bountyPool(poolSubject);

        vm.prank(stranger);
        vault.fundWatch{value: 2 ether}(poolSubject);

        assertEq(vault.bountyPool(poolSubject) - before, 2 ether);
    }

    /// @notice The bounty schedule is derived from the protocol's own cost curve: a long continuity
    ///         proof means stale evidence, and stale evidence pays less.
    function test_bountyTiers() public view {
        assertEq(vault.bountyFor(poolSubject, 0), 0.05 ether);
        assertEq(vault.bountyFor(poolSubject, 100), 0.05 ether, "boundary: still fresh");
        assertEq(vault.bountyFor(poolSubject, 101), 0.025 ether);
        assertEq(vault.bountyFor(poolSubject, 900), 0.025 ether, "boundary: pre-checkpoint");
        assertEq(vault.bountyFor(poolSubject, 901), 0.01 ether, "past the 24h checkpoint cliff");
    }

    function test_bountyClampedToPool() public {
        bytes32 unfunded = keccak256("unfunded subject");
        assertEq(vault.bountyFor(unfunded, 10), 0, "no pool, no bounty");
    }

    /// @notice The per-block payout cap bounds rule bugs and griefing alike - and is what makes
    ///         accepting third-party rules safe later.
    function test_payoutCapBoundsASingleBlock() public {
        vm.prank(owner);
        registry.setPayoutCap(poolSubject, 5 ether);

        vm.prank(victim);
        vault.buyCover{value: 10 ether}(poolSubject, 1000e8, 30 days);

        EvidenceInput memory input = evidence(
            poolSubject,
            intraBlock.ruleId(),
            MAINNET,
            u64(21_340_118, 21_340_118, 21_340_118),
            u32(46, 47, 48),
            sandwichTxs(1 ether, 5 ether, 0.01 ether),
            10
        );

        uint256 before = victim.balance;
        vm.prank(prosecutor);
        core.submitEvidence(input);

        assertEq(victim.balance - before, 5 ether, "$34 of damages, capped at 5 CTC for this block");
    }

    function test_onlyCoreMaySettle() public {
        vm.expectRevert(UnderwritingVault.NotCore.selector);
        vault.settle(bytes32("i"), poolSubject, victim, 1e8, prosecutor, 10);
    }

    function test_onlyOwnerMaySetParams() public {
        vm.prank(victim);
        vm.expectRevert();
        vault.setParams(2e8, 1 ether, 1 ether);

        vm.prank(owner);
        vault.setParams(2e8, 1 ether, 1 ether);
        assertEq(vault.usdPerCtcE8(), 2e8);
    }

    // ------------------------------------------------------------- premiums

    /// @notice Underwriting is only a business if the income arrives. Premiums accrue per unit of
    ///         stake at the moment cover is bought, and are claimable without touching the stake.
    function test_premiumsAccrueToUnderwritersProRata() public {
        address second = makeAddr("secondUnderwriter");
        vm.deal(second, 400 ether);
        vm.prank(second);
        vault.stake{value: 200 ether}(poolSubject); // now 200 + 200 = 400 staked, half each

        vm.prank(victim);
        vault.buyCover{value: 2 ether}(poolSubject, 100e8, 30 days);

        assertEq(vault.claimablePremiums(poolSubject, underwriter), 1 ether, "half the premium");
        assertEq(vault.claimablePremiums(poolSubject, second), 1 ether, "half the premium");

        uint256 before = second.balance;
        vm.prank(second);
        vault.claimPremiums(poolSubject);
        assertEq(second.balance - before, 1 ether);
        assertEq(vault.claimablePremiums(poolSubject, second), 0, "cannot claim twice");
        assertEq(vault.trancheOf(poolSubject).staked, 400 ether, "the stake itself is untouched");
    }

    /// @notice You earn from the policies written while you were backing the subject, and nothing
    ///         from the ones written before you arrived.
    function test_lateUnderwriterEarnsNothingFromEarlierPolicies() public {
        vm.prank(victim);
        vault.buyCover{value: 2 ether}(poolSubject, 100e8, 30 days);

        address latecomer = makeAddr("latecomer");
        vm.deal(latecomer, 400 ether);
        vm.prank(latecomer);
        vault.stake{value: 200 ether}(poolSubject);

        assertEq(vault.claimablePremiums(poolSubject, latecomer), 0, "staked after the policy was written");
        assertEq(vault.claimablePremiums(poolSubject, underwriter), 2 ether, "the whole premium");
    }

    /// @notice Unstaking settles what is owed in the same transaction - nobody has to remember to
    ///         collect before they leave.
    function test_unstakeCarriesOutstandingPremiums() public {
        vm.prank(victim);
        vault.buyCover{value: 2 ether}(poolSubject, 100e8, 30 days);

        uint256 before = underwriter.balance;
        vm.prank(underwriter);
        vault.unstake(poolSubject, 50 ether);

        assertEq(underwriter.balance - before, 52 ether, "50 stake + 2 premium");
        assertEq(vault.claimablePremiums(poolSubject, underwriter), 0);
    }

    /// @notice A premium paid on a subject nobody is underwriting is parked, not handed to whoever
    ///         stakes next - that would pay for risk they never carried.
    function test_premiumOnUnbackedSubjectIsParked() public {
        vm.prank(owner);
        registry.setPayoutCap(feedSubject, 1 ether);

        vm.prank(victim);
        vault.buyCover{value: 1 ether}(feedSubject, 100e8, 30 days);
        assertEq(vault.unallocatedPremiums(feedSubject), 1 ether);

        address opportunist = makeAddr("opportunist");
        vm.deal(opportunist, 10 ether);
        vm.prank(opportunist);
        vault.stake{value: 1 ether}(feedSubject);
        assertEq(vault.claimablePremiums(feedSubject, opportunist), 0);
    }

    /// @notice USD is the unit of judgement; CTC is the unit of settlement.
    function test_usdToCtcConversion() public {
        assertEq(vault.usdToCtc(100e8), 100 ether, "at $1/CTC");

        vm.prank(owner);
        vault.setParams(2e8, 0.05 ether, 0.1 ether); // $2 per CTC
        assertEq(vault.usdToCtc(100e8), 50 ether);
    }
}
