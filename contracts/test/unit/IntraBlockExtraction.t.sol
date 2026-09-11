// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Base} from "../Base.t.sol";
import {EvidenceLib} from "../../src/libs/EvidenceLib.sol";
import {EvidenceInput} from "../../src/interfaces/IWatchtowerCore.sol";
import {Verdict} from "../../src/types/Types.sol";
import {TxFixture} from "../TxFixture.sol";

/// @notice The flagship: a sandwich proven, priced and paid inside one transaction.
contract IntraBlockExtractionTest is Base {
    uint64 internal constant BLOCK = 21_340_118;
    uint256 internal constant PRICE_E8 = 3400e8; // $3,400 / ETH, proven from Chainlink

    function setUp() public override {
        super.setUp();
        seedPrice(feedSubject, PRICE_E8, 2001, 12);

        vm.deal(victim, 10 ether);
        vm.prank(victim);
        vault.buyCover{value: 1 ether}(poolSubject, 100e8, 30 days); // $100 of cover
    }

    function _sandwichEvidence(uint32 firstIndex, uint256 continuityLength)
        internal
        view
        returns (EvidenceInput memory)
    {
        return evidence(
            poolSubject,
            intraBlock.ruleId(),
            MAINNET,
            u64(BLOCK, BLOCK, BLOCK),
            u32(firstIndex, firstIndex + 1, firstIndex + 2),
            sandwichTxs(1 ether, 5 ether, 0.01 ether),
            continuityLength
        );
    }

    /// @dev The whole thesis in one test: three adjacent Ethereum transactions, verified by the
    ///      precompile, judged on Creditcoin, paid from the vault - in a single call.
    function test_provesSandwichAndPays() public {
        uint256 victimBefore = victim.balance;
        uint256 prosecutorBefore = prosecutor.balance;

        EvidenceInput memory input = _sandwichEvidence(46, 10);
        vm.prank(prosecutor);
        bytes32 incidentId = core.submitEvidence(input);

        // extracted 0.01 ETH at $3,400 => $34.00, and the demo vault settles $1 = 1 CTC.
        assertEq(victim.balance - victimBefore, 34 ether, "restitution");
        assertEq(prosecutor.balance - prosecutorBefore, 0.05 ether, "full freshness bounty");
        assertEq(uint256(core.incidentOf(incidentId).status), 2, "settled");
        assertEq(core.incidentOf(incidentId).damagesUsd, 34e8, "damages in USD, 8 decimals");
    }

    /// @notice The dashboard can show a verdict before anyone pays gas for it.
    function test_previewMatchesSettlement() public view {
        (bool verified, Verdict memory verdict) = core.previewEvidence(_sandwichEvidence(46, 10));
        assertTrue(verified);
        assertTrue(verdict.violated);
        assertEq(verdict.beneficiary, victim);
        assertEq(verdict.damages, 34e8);
    }

    /// @notice Position is what makes the claim. Break adjacency and there is no sandwich.
    function test_rejectsNonAdjacentWindow() public {
        EvidenceInput memory input = evidence(
            poolSubject,
            intraBlock.ruleId(),
            MAINNET,
            u64(BLOCK, BLOCK, BLOCK),
            u32(46, 47, 49), // one seat further along: no longer a bracket
            sandwichTxs(1 ether, 5 ether, 0.01 ether),
            10
        );

        vm.prank(prosecutor);
        vm.expectRevert(EvidenceLib.WindowNotAdjacent.selector);
        core.submitEvidence(input);
    }

    /// @notice Adjacent transactions from three different senders are just ordinary trading.
    function test_noVerdictWhenBracketsAreDifferentSenders() public {
        bytes[] memory txs = new bytes[](3);
        txs[0] = TxFixture.legacy(
            attacker, pool, 0, 1, 1e5, 20 gwei, TxFixture.logs1(TxFixture.swapLog(pool, 1 ether, 0, 0, 2 ether))
        );
        txs[1] = TxFixture.legacy(
            victim, pool, 0, 1, 1e5, 20 gwei, TxFixture.logs1(TxFixture.swapLog(pool, 5 ether, 0, 0, 10 ether))
        );
        txs[2] = TxFixture.legacy(
            makeAddr("someoneElse"), pool, 0, 1, 1e5, 20 gwei,
            TxFixture.logs1(TxFixture.swapLog(pool, 0, 2 ether, 1.01 ether, 0))
        );

        EvidenceInput memory input = evidence(poolSubject, intraBlock.ruleId(), MAINNET, u64(BLOCK, BLOCK, BLOCK), u32(60, 61, 62), txs, 10);
        vm.prank(prosecutor);
        core.submitEvidence(input);

        assertEq(victim.balance, 9 ether, "no restitution: paid 1 ETH premium, received nothing");
    }

    /// @notice A round trip that lost money is not extraction.
    function test_noVerdictWhenRoundTripDidNotProfit() public {
        bytes[] memory txs = sandwichTxs(1 ether, 5 ether, 0);
        EvidenceInput memory input = evidence(poolSubject, intraBlock.ruleId(), MAINNET, u64(BLOCK, BLOCK, BLOCK), u32(70, 71, 72), txs, 10);
        vm.prank(prosecutor);
        core.submitEvidence(input);
        assertEq(victim.balance, 9 ether, "no restitution");
    }

    /// @notice A victim who swapped the other way was not sandwiched by this pair.
    function test_noVerdictWhenVictimTradedOppositeDirection() public {
        bytes[] memory txs = new bytes[](3);
        txs[0] = TxFixture.legacy(
            attacker, pool, 0, 1, 1e5, 20 gwei, TxFixture.logs1(TxFixture.swapLog(pool, 1 ether, 0, 0, 2 ether))
        );
        txs[1] = TxFixture.legacy(
            victim, pool, 0, 1, 1e5, 20 gwei, TxFixture.logs1(TxFixture.swapLog(pool, 0, 5 ether, 2 ether, 0))
        );
        txs[2] = TxFixture.legacy(
            attacker, pool, 0, 1, 1e5, 20 gwei, TxFixture.logs1(TxFixture.swapLog(pool, 0, 2 ether, 1.01 ether, 0))
        );

        EvidenceInput memory input = evidence(poolSubject, intraBlock.ruleId(), MAINNET, u64(BLOCK, BLOCK, BLOCK), u32(80, 81, 82), txs, 10);
        vm.prank(prosecutor);
        core.submitEvidence(input);
        assertEq(victim.balance, 9 ether, "no restitution");
    }

    /// @notice Swaps on some other pool in the same block prove nothing about this subject.
    function test_ignoresSwapsOnAnotherPool() public {
        address otherPool = makeAddr("otherPool");
        bytes[] memory txs = new bytes[](3);
        txs[0] = TxFixture.legacy(
            attacker, otherPool, 0, 1, 1e5, 20 gwei, TxFixture.logs1(TxFixture.swapLog(otherPool, 1 ether, 0, 0, 2 ether))
        );
        txs[1] = TxFixture.legacy(
            victim, otherPool, 0, 1, 1e5, 20 gwei, TxFixture.logs1(TxFixture.swapLog(otherPool, 5 ether, 0, 0, 10 ether))
        );
        txs[2] = TxFixture.legacy(
            attacker, otherPool, 0, 1, 1e5, 20 gwei,
            TxFixture.logs1(TxFixture.swapLog(otherPool, 0, 2 ether, 1.01 ether, 0))
        );

        EvidenceInput memory input = evidence(poolSubject, intraBlock.ruleId(), MAINNET, u64(BLOCK, BLOCK, BLOCK), u32(90, 91, 92), txs, 10);
        vm.prank(prosecutor);
        core.submitEvidence(input);
        assertEq(victim.balance, 9 ether, "no restitution");
    }

    /// @notice Cover bounds restitution: a $34 loss under $10 of cover pays $10.
    function test_payoutIsCappedByCover() public {
        address smallHolder = makeAddr("smallHolder");
        vm.deal(smallHolder, 10 ether);

        // Rebuild the sandwich with the small holder as the victim.
        bytes[] memory txs = new bytes[](3);
        txs[0] = TxFixture.legacy(
            attacker, pool, 0, 1, 1e5, 20 gwei, TxFixture.logs1(TxFixture.swapLog(pool, 1 ether, 0, 0, 2 ether))
        );
        txs[1] = TxFixture.legacy(
            smallHolder, pool, 0, 1, 1e5, 20 gwei, TxFixture.logs1(TxFixture.swapLog(pool, 5 ether, 0, 0, 10 ether))
        );
        txs[2] = TxFixture.legacy(
            attacker, pool, 0, 1, 1e5, 20 gwei, TxFixture.logs1(TxFixture.swapLog(pool, 0, 2 ether, 1.01 ether, 0))
        );

        vm.prank(smallHolder);
        vault.buyCover{value: 0.1 ether}(poolSubject, 10e8, 30 days); // $10 of cover

        uint256 before = smallHolder.balance;
        EvidenceInput memory input = evidence(poolSubject, intraBlock.ruleId(), MAINNET, u64(BLOCK, BLOCK, BLOCK), u32(100, 101, 102), txs, 10);
        vm.prank(prosecutor);
        core.submitEvidence(input);

        assertEq(smallHolder.balance - before, 10 ether, "capped at cover");
    }

    /// @notice An uncovered victim still gets a public verdict; only the money needs a policy.
    function test_verdictRecordedWithoutCover() public {
        address uncovered = makeAddr("uncovered");
        bytes[] memory txs = new bytes[](3);
        txs[0] = TxFixture.legacy(
            attacker, pool, 0, 1, 1e5, 20 gwei, TxFixture.logs1(TxFixture.swapLog(pool, 1 ether, 0, 0, 2 ether))
        );
        txs[1] = TxFixture.legacy(
            uncovered, pool, 0, 1, 1e5, 20 gwei, TxFixture.logs1(TxFixture.swapLog(pool, 5 ether, 0, 0, 10 ether))
        );
        txs[2] = TxFixture.legacy(
            attacker, pool, 0, 1, 1e5, 20 gwei, TxFixture.logs1(TxFixture.swapLog(pool, 0, 2 ether, 1.01 ether, 0))
        );

        EvidenceInput memory input =
            evidence(poolSubject, intraBlock.ruleId(), MAINNET, u64(BLOCK, BLOCK, BLOCK), u32(110, 111, 112), txs, 10);
        vm.prank(prosecutor);
        bytes32 incidentId = core.submitEvidence(input);

        assertEq(uncovered.balance, 0, "no payout without cover");
        assertEq(core.incidentOf(incidentId).damagesUsd, 34e8, "but the verdict stands");
    }

    /// @notice A pool has two tokens and the linked feed prices one of them. A sandwich run in the
    ///         unpriced direction is real, but this instance declines rather than publishing a figure
    ///         that is wrong by twelve orders of magnitude.
    /// @dev Concretely: on the canonical Uniswap V2 USDC/WETH pair token0 is USDC (6 decimals), so an
    ///      ETH/USD feed cannot price a round trip the searcher funded with USDC.
    function test_declinesSandwichOnTheUnpricedSide() public {
        // This suite's instance is configured with the priced token on side0.
        assertTrue(intraBlock.PRICED_SIDE_IS_TOKEN0());

        bytes[] memory txs = new bytes[](3);
        txs[0] = TxFixture.legacy(
            attacker, pool, 0, 1, 1e5, 20 gwei, TxFixture.logs1(TxFixture.swapLog(pool, 0, 1 ether, 2 ether, 0))
        );
        txs[1] = TxFixture.legacy(
            victim, pool, 0, 1, 1e5, 20 gwei, TxFixture.logs1(TxFixture.swapLog(pool, 0, 5 ether, 10 ether, 0))
        );
        txs[2] = TxFixture.legacy(
            attacker, pool, 0, 1, 1e5, 20 gwei, TxFixture.logs1(TxFixture.swapLog(pool, 2 ether, 0, 0, 1.01 ether))
        );

        EvidenceInput memory input =
            evidence(poolSubject, intraBlock.ruleId(), MAINNET, u64(BLOCK, BLOCK, BLOCK), u32(120, 121, 122), txs, 10);
        vm.prank(prosecutor);
        core.submitEvidence(input);

        assertEq(victim.balance, 9 ether, "profitable round trip, but not in a token this rule can price");
    }

    /// @notice Evidence older than the checkpoint cliff carries a long continuity proof, and the
    ///         bounty schedule prices that: prosecutors are paid to be early.
    function test_bountyDecaysWithContinuityLength() public view {
        uint256 fresh = vault.bountyFor(poolSubject, 10);
        uint256 aging = vault.bountyFor(poolSubject, 500);
        uint256 stale = vault.bountyFor(poolSubject, 1000);

        assertEq(fresh, 0.05 ether);
        assertEq(aging, 0.025 ether);
        assertEq(stale, 0.01 ether);
    }
}
