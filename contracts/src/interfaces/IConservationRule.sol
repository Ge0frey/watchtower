// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccDelta, Settlement, SubjectView, Verdict, VerifiedTx, WindowShape} from "../types/Types.sol";

/// @title IConservationRule
/// @notice A risk Watchtower knows how to prove.
/// @dev Rules are pure judgement: they hold no state and touch no money. `evaluate` is `view`, so
///      the core reaches them through STATICCALL and a rule that tries to write reverts. A buggy or
///      hostile rule can therefore mis-judge a single incident - bounded by the subject's payout cap -
///      but can never drain the vault. That is what makes an open rule library safe.
interface IConservationRule {
    /// @notice Stable identifier, e.g. keccak256("watchtower.rule.intra-block-extraction.v1").
    function ruleId() external pure returns (bytes32);

    /// @notice The evidence window shape this rule requires. The core enforces it.
    function windowShape() external pure returns (WindowShape);

    /// @notice Whether a violation pays immediately or after a challenge window.
    function settlement() external pure returns (Settlement);

    /// @notice Human-readable name for dashboards and submissions.
    function name() external pure returns (string memory);

    /// @notice Judge a verified window against the subject's accumulator.
    /// @param subjectId The subject the evidence is filed against.
    /// @param window Transactions already verified by the Block Prover Precompile, sorted ascending.
    /// @param state Read-only accumulator for the subject.
    /// @return verdict Whether the invariant broke, who is owed, and how much (USD, 8 decimals).
    /// @return delta Accumulator mutation to apply. Stream rules must advance the cursor.
    function evaluate(bytes32 subjectId, VerifiedTx[] calldata window, SubjectView calldata state)
        external
        view
        returns (Verdict memory verdict, AccDelta memory delta);
}
