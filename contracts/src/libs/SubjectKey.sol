// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title SubjectKey
/// @notice Deterministic identifiers for subjects, evidence entries and incidents.
library SubjectKey {
    /// @notice A subject is a (chain, contract, rule) triple, so the same contract can be watched
    ///         under several rules without the accumulators colliding.
    function subjectId(uint64 chainKey, address sourceContract, bytes32 ruleId) internal pure returns (bytes32) {
        return keccak256(abi.encode(chainKey, sourceContract, ruleId));
    }

    /// @notice Replay-guard key. RULE-SCOPED ON PURPOSE.
    /// @dev The protocol's own reference ASC dedupes on (chainKey, height, txIndex) alone. Watchtower
    ///      cannot: one Ethereum transaction is legitimately evidence under several rules at once -
    ///      a bridge `Locked` transaction feeds the reserve accumulator, and the very same transaction
    ///      may later be the subject of a gap challenge. A global guard would make the second use
    ///      impossible.
    function evidenceKey(bytes32 ruleId, bytes32 subject, uint64 chainKey, uint64 height, uint32 index)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(ruleId, subject, chainKey, height, index));
    }

    /// @notice Incident identity is the *incident*, not the transaction.
    /// @dev Keyed on the window's first coordinate so a prosecutor cannot re-file the same sandwich
    ///      from a shifted window and collect twice.
    function incidentId(bytes32 ruleId, bytes32 subject, uint64 height, uint32 firstIndex)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode("watchtower.incident", ruleId, subject, height, firstIndex));
    }
}
