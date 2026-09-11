// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {INativeQueryVerifier} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

/// @title MockBlockProver
/// @notice Stand-in for the Block Prover Precompile in offline unit tests.
///
/// @dev Why a mock at all: Creditcoin's precompile is native runtime code, not EVM bytecode, so
///      forking CC3 with anvil does NOT give you `0x0FD2`. `vm.etch` is the only way to exercise the
///      core offline - which means this mock has to be STATELESS, because `vm.etch` copies runtime
///      code and leaves storage behind.
///
///      It therefore derives the transaction index the same way a Merkle path does: walking from the
///      leaf upward, a sibling on the left means our node was the right child, so bit `i` is set.
///      A zero Merkle root is treated as "unverifiable", which is how tests force the failure path.
contract MockBlockProver is INativeQueryVerifier {
    function verify(
        uint64,
        uint64,
        bytes calldata,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata
    ) external pure override returns (bool) {
        return merkleProof.root != bytes32(0);
    }

    function verify(
        uint64,
        uint64[] calldata,
        bytes[] calldata,
        MerkleProof[] calldata merkleProofs,
        ContinuityProof calldata
    ) external pure override returns (bool) {
        for (uint256 i; i < merkleProofs.length; ++i) {
            if (merkleProofs[i].root == bytes32(0)) return false;
        }
        return true;
    }

    function verifyAndEmit(
        uint64 chainKey,
        uint64 height,
        bytes calldata,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata
    ) external override returns (bool) {
        if (merkleProof.root == bytes32(0)) return false;
        emit TransactionVerified(chainKey, height, _index(merkleProof));
        return true;
    }

    function verifyAndEmit(
        uint64 chainKey,
        uint64[] calldata heights,
        bytes[] calldata,
        MerkleProof[] calldata merkleProofs,
        ContinuityProof calldata
    ) external override returns (bool) {
        for (uint256 i; i < merkleProofs.length; ++i) {
            if (merkleProofs[i].root == bytes32(0)) return false;
            emit TransactionVerified(chainKey, heights[i], _index(merkleProofs[i]));
        }
        return true;
    }

    function calculateTxIndex(MerkleProof calldata merkleProof) external pure override returns (uint64) {
        return _index(merkleProof);
    }

    function _index(MerkleProof calldata merkleProof) private pure returns (uint64 index) {
        for (uint256 i; i < merkleProof.siblings.length; ++i) {
            if (merkleProof.siblings[i].isLeft) index |= uint64(1) << uint64(i);
        }
    }
}
