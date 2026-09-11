// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {VerifiedTx, WindowShape} from "../types/Types.sol";

/// @title EvidenceLib
/// @notice Window discipline for verified evidence.
/// @dev Transaction-index derivation is deliberately NOT here. The Block Prover Precompile exposes
///      `calculateTxIndex(MerkleProof)`, so the coordinate every Watchtower rule reasons about is
///      produced by the protocol itself rather than by our arithmetic. What remains is ordering.
library EvidenceLib {
    error WindowEmpty();
    error WindowWrongLength(uint256 expected, uint256 actual);
    error WindowNotAdjacent();
    error WindowNotAscending();
    error CursorRegression();

    /// @notice Insertion sort by (blockHeight, txIndex). Windows are at most 10 entries.
    /// @dev The proof builder returns batch results in a map, whose iteration order carries no
    ///      guarantee. Workers sort before submitting; we sort again because we do not trust them.
    function sortByCoordinate(VerifiedTx[] memory window) internal pure {
        uint256 n = window.length;
        for (uint256 i = 1; i < n; ++i) {
            VerifiedTx memory key = window[i];
            uint256 j = i;
            while (j > 0 && _after(window[j - 1], key)) {
                window[j] = window[j - 1];
                unchecked {
                    --j;
                }
            }
            window[j] = key;
        }
    }

    /// @notice True when `a` sits strictly after `b` in source-chain order.
    function _after(VerifiedTx memory a, VerifiedTx memory b) private pure returns (bool) {
        if (a.blockHeight != b.blockHeight) return a.blockHeight > b.blockHeight;
        return a.txIndex > b.txIndex;
    }

    /// @notice Every entry in the same block, at strictly consecutive indices.
    /// @dev This is the assertion that makes a sandwich provable: Ethereum contracts cannot see
    ///      their neighbours, so adjacency is exactly the fact no source-chain contract can check.
    function requireAdjacent(VerifiedTx[] memory window) internal pure {
        uint256 n = window.length;
        if (n == 0) revert WindowEmpty();
        uint64 height = window[0].blockHeight;
        for (uint256 i = 1; i < n; ++i) {
            if (window[i].blockHeight != height) revert WindowNotAdjacent();
            if (window[i].txIndex != window[i - 1].txIndex + 1) revert WindowNotAdjacent();
        }
    }

    /// @notice Strictly ascending coordinates, all beyond the subject's cursor.
    function requireAscendingBeyond(VerifiedTx[] memory window, uint64 cursorHeight, uint32 cursorIndex)
        internal
        pure
    {
        uint256 n = window.length;
        if (n == 0) revert WindowEmpty();
        if (!_strictlyAfter(window[0].blockHeight, window[0].txIndex, cursorHeight, cursorIndex)) {
            revert CursorRegression();
        }
        for (uint256 i = 1; i < n; ++i) {
            if (!_strictlyAfter(window[i].blockHeight, window[i].txIndex, window[i - 1].blockHeight, window[i - 1].txIndex))
            {
                revert WindowNotAscending();
            }
        }
    }

    function requireLength(VerifiedTx[] memory window, uint256 expected) internal pure {
        if (window.length != expected) revert WindowWrongLength(expected, window.length);
    }

    /// @notice Enforce the shape a rule declared. Called by the core, never by a rule.
    function enforceShape(VerifiedTx[] memory window, WindowShape shape, uint64 cursorHeight, uint32 cursorIndex)
        internal
        pure
    {
        if (shape == WindowShape.SINGLE_TX) {
            requireLength(window, 1);
        } else if (shape == WindowShape.INTRA_BLOCK_ADJACENT) {
            requireAdjacent(window);
        } else {
            requireAscendingBeyond(window, cursorHeight, cursorIndex);
        }
    }

    function _strictlyAfter(uint64 h, uint32 i, uint64 refH, uint32 refI) private pure returns (bool) {
        if (h != refH) return h > refH;
        return i > refI;
    }

    /// @notice Coordinate of the last entry in a sorted window.
    function head(VerifiedTx[] memory window) internal pure returns (uint64 height, uint32 index) {
        VerifiedTx memory last = window[window.length - 1];
        return (last.blockHeight, last.txIndex);
    }

    /// @notice Stable hash of a window, recorded on the verdict as the evidence fingerprint.
    function fingerprint(VerifiedTx[] memory window) internal pure returns (bytes32) {
        bytes32 acc;
        for (uint256 i; i < window.length; ++i) {
            acc = keccak256(
                abi.encode(acc, window[i].chainKey, window[i].blockHeight, window[i].txIndex, keccak256(window[i].encodedTx))
            );
        }
        return acc;
    }
}
