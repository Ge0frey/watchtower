// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";
import {IConservationRule} from "../interfaces/IConservationRule.sol";
import {SubjectRegistry} from "../core/SubjectRegistry.sol";
import {AccDelta, Settlement, SubjectView, Verdict, VerifiedTx, WindowShape} from "../types/Types.sol";

/// @title ChainlinkFeed
/// @notice Imports the price Chainlink itself published on Ethereum - proven, not reported.
///
/// @dev Chainlink will never deploy to Creditcoin on our schedule, and it does not have to. Every
///      feed update is an Ethereum transaction emitting `AnswerUpdated`, so the Attestcoin Protocol
///      can prove it and Creditcoin inherits the price permissionlessly. Watchtower needs this to
///      denominate damages: without it a verdict is quoted in wei and a reserve ratio is unitless.
///
///      This is a SOURCE rule, not a risk rule - `violated` is always false. It only ever advances
///      the accumulator, which is why it settles under the optimistic path harmlessly.
///
///      The subject's `sourceContract` must be the AGGREGATOR, not the consumer-facing proxy:
///      `AnswerUpdated` is emitted by the aggregator.
contract ChainlinkFeed is IConservationRule {
    /// @dev keccak256("AnswerUpdated(int256,uint256,uint256)") - `current` and `roundId` are indexed,
    ///      so the answer arrives in topics[1] and the round in topics[2].
    bytes32 internal constant ANSWER_UPDATED = keccak256("AnswerUpdated(int256,uint256,uint256)");

    SubjectRegistry public immutable REGISTRY;

    constructor(SubjectRegistry registry_) {
        REGISTRY = registry_;
    }

    function ruleId() external pure override returns (bytes32) {
        return keccak256("watchtower.rule.chainlink-feed.v1");
    }

    function windowShape() external pure override returns (WindowShape) {
        return WindowShape.SEQUENTIAL_STREAM;
    }

    function settlement() external pure override returns (Settlement) {
        return Settlement.OPTIMISTIC;
    }

    function name() external pure override returns (string memory) {
        return "ChainlinkFeed";
    }

    /// @inheritdoc IConservationRule
    function evaluate(bytes32 subjectId, VerifiedTx[] calldata window, SubjectView calldata)
        external
        view
        override
        returns (Verdict memory verdict, AccDelta memory delta)
    {
        verdict; // a price feed cannot be "violated" - it only ever advances the accumulator
        address aggregator = REGISTRY.getSubject(subjectId).sourceContract;

        uint256 latestRound;
        uint256 answer;

        for (uint256 i; i < window.length; ++i) {
            if (!window[i].success) continue;
            (bool found, uint256 round, uint256 value) = _latestAnswer(window[i].encodedTx, aggregator);
            if (found && round >= latestRound) {
                latestRound = round;
                answer = value;
            }
        }

        if (answer != 0) delta.price = answer;
        (delta.newHeight, delta.newIndex) = _head(window);
        // verdict stays zeroed: a price feed cannot be "violated", only stale.
    }

    function _latestAnswer(bytes memory encodedTx, address aggregator)
        private
        pure
        returns (bool found, uint256 roundId, uint256 answer)
    {
        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTx);
        EvmV1Decoder.LogEntry[] memory logs = EvmV1Decoder.getLogsByEventSignature(receipt, ANSWER_UPDATED);

        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].address_ != aggregator) continue;
            if (logs[i].topics.length < 3) continue;

            int256 current = int256(uint256(logs[i].topics[1]));
            if (current <= 0) continue; // a non-positive price is never usable collateral maths

            uint256 round = uint256(logs[i].topics[2]);
            if (!found || round >= roundId) {
                found = true;
                roundId = round;
                answer = uint256(current);
            }
        }
    }

    function _head(VerifiedTx[] calldata window) private pure returns (uint64 height, uint32 index) {
        VerifiedTx calldata last = window[window.length - 1];
        return (last.blockHeight, last.txIndex);
    }
}
