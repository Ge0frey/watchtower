// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Base} from "../Base.t.sol";
import {EvidenceInput} from "../../src/interfaces/IWatchtowerCore.sol";
import {FailedTx} from "../../src/rules/FailedTx.sol";
import {TxFixture} from "../TxFixture.sol";

/// @notice The two rules that cost an afternoon each - which is the point. Same engine, same vault,
///         same feed; only the pure judgement differs.
contract FailedTxAndFeedTest is Base {
    address internal user = makeAddr("unluckyUser");
    address internal node = makeAddr("chainlinkNode");

    function setUp() public override {
        super.setUp();
        seedPrice(feedSubject, 3400e8, 2001, 12);

        vm.deal(user, 10 ether);
        vm.prank(user);
        vault.buyCover{value: 1 ether}(accountSubject, 100e8, 30 days);
    }

    // ---------------------------------------------------------------- FailedTx

    /// @notice The one place in the codebase that inverts the receipt-status check.
    function test_paysForRevertedTransaction() public {
        // 100,000 gas at 30 gwei = 0.003 ETH burned; at $3,400 that is $10.20.
        bytes memory reverted =
            TxFixture.legacy(user, address(0xBEEF), 0, 0, 100_000, 30 gwei, TxFixture.logs0());

        EvidenceInput memory input =
            singleEvidence(accountSubject, failedTx.ruleId(), SEPOLIA, 500, 4, reverted, 10);

        uint256 before = user.balance;
        vm.prank(prosecutor);
        core.submitEvidence(input);

        assertEq(user.balance - before, 10.2 ether, "$10.20 of burned gas reimbursed");
    }

    /// @notice A transaction that succeeded is not a claim under this rule.
    function test_ignoresSuccessfulTransaction() public {
        bytes memory ok = TxFixture.legacy(user, address(0xBEEF), 0, 1, 100_000, 30 gwei, TxFixture.logs0());
        EvidenceInput memory input =
            singleEvidence(accountSubject, failedTx.ruleId(), SEPOLIA, 501, 4, ok, 10);

        uint256 before = user.balance;
        vm.prank(prosecutor);
        core.submitEvidence(input);
        assertEq(user.balance, before, "no payout");
    }

    /// @notice EIP-1559 transactions carry maxFeePerGas rather than the effective price, so the
    ///         reimbursement is an upper bound - stated, not hidden, and bounded by the policy.
    function test_handlesEip1559Transactions() public {
        bytes memory reverted = TxFixture.eip1559(user, address(0xBEEF), 0, 50_000, 20 gwei, TxFixture.logs0());
        EvidenceInput memory input =
            singleEvidence(accountSubject, failedTx.ruleId(), SEPOLIA, 502, 1, reverted, 10);

        uint256 before = user.balance;
        vm.prank(prosecutor);
        core.submitEvidence(input);

        assertEq(user.balance - before, 3.4 ether, "0.001 ETH at $3,400");
    }

    /// @notice EIP-2930 access-list transactions still carry a flat `gasPrice`, and people still
    ///         send them. The decoder ships no helper for type 1, so the rule reads the chunk against
    ///         the library's own layout rather than refusing an ordinary transaction.
    function test_handlesEip2930Transactions() public {
        // 80,000 gas at 25 gwei = 0.002 ETH; at $3,400 that is $6.80.
        bytes memory reverted = TxFixture.eip2930(user, address(0xBEEF), 0, 80_000, 25 gwei, TxFixture.logs0());
        EvidenceInput memory input =
            singleEvidence(accountSubject, failedTx.ruleId(), SEPOLIA, 504, 2, reverted, 10);

        uint256 before = user.balance;
        vm.prank(prosecutor);
        core.submitEvidence(input);

        assertEq(user.balance - before, 6.8 ether, "0.002 ETH at $3,400");
    }

    /// @notice Blob and authorization-list transactions are out of scope for v1, loudly.
    /// @dev The refusal is the point. Types 3 and 4 carry a fourth chunk whose split the decoder does
    ///      not expose, so a guess would reimburse from the wrong field - better to name the type.
    function test_revertsOnUnsupportedTxType() public {
        bytes memory blob = TxFixture.blobTx(user, address(0xBEEF), 0, 100_000, TxFixture.logs0());
        EvidenceInput memory input =
            singleEvidence(accountSubject, failedTx.ruleId(), SEPOLIA, 503, 1, blob, 10);

        vm.prank(prosecutor);
        vm.expectRevert(abi.encodeWithSelector(FailedTx.UnsupportedTxType.selector, uint8(3)));
        core.submitEvidence(input);
    }

    // ------------------------------------------------------------ ChainlinkFeed

    /// @notice Creditcoin inherits Ethereum's oracles without their permission: the answer is proven,
    ///         not reported.
    function test_importsProvenPrice() public view {
        (uint256 answer, uint64 provenAt) = core.price(feedSubject);
        assertEq(answer, 3400e8);
        assertEq(provenAt, 2001);
    }

    function test_priceAdvancesWithNewRounds() public {
        bytes memory update = TxFixture.legacy(
            node, aggregator, 0, 1, 80_000, 10 gwei,
            TxFixture.logs1(TxFixture.answerUpdatedLog(aggregator, 3555e8, 2, block.timestamp))
        );
        EvidenceInput memory input =
            singleEvidence(feedSubject, feed.ruleId(), MAINNET, 2100, 0, update, 10);
        vm.prank(prosecutor);
        core.submitEvidence(input);

        (uint256 answer, uint64 provenAt) = core.price(feedSubject);
        assertEq(answer, 3555e8);
        assertEq(provenAt, 2100);
    }

    /// @notice `AnswerUpdated` from an impostor contract is ignored - the subject names the aggregator.
    function test_ignoresAnswersFromOtherContracts() public {
        bytes memory spoof = TxFixture.legacy(
            node, aggregator, 0, 1, 80_000, 10 gwei,
            TxFixture.logs1(TxFixture.answerUpdatedLog(makeAddr("fakeAggregator"), 1e8, 9, block.timestamp))
        );
        EvidenceInput memory input =
            singleEvidence(feedSubject, feed.ruleId(), MAINNET, 2200, 0, spoof, 10);
        vm.prank(prosecutor);
        core.submitEvidence(input);

        (uint256 answer,) = core.price(feedSubject);
        assertEq(answer, 3400e8, "price unchanged");
    }

    /// @notice Damages denominated by the imported price: change the price, change the verdict.
    function test_priceFlowsIntoDamages() public {
        bytes memory update = TxFixture.legacy(
            node, aggregator, 0, 1, 80_000, 10 gwei,
            TxFixture.logs1(TxFixture.answerUpdatedLog(aggregator, 1700e8, 3, block.timestamp))
        );
        EvidenceInput memory priceInput =
            singleEvidence(feedSubject, feed.ruleId(), MAINNET, 2300, 0, update, 10);
        vm.prank(prosecutor);
        core.submitEvidence(priceInput);

        bytes memory reverted =
            TxFixture.legacy(user, address(0xBEEF), 0, 0, 100_000, 30 gwei, TxFixture.logs0());
        EvidenceInput memory input =
            singleEvidence(accountSubject, failedTx.ruleId(), SEPOLIA, 600, 4, reverted, 10);

        uint256 before = user.balance;
        vm.prank(prosecutor);
        core.submitEvidence(input);

        assertEq(user.balance - before, 5.1 ether, "same gas, half the price, half the claim");
    }
}
