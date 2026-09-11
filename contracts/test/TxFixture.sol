// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";
import {INativeQueryVerifier} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

/// @title TxFixture
/// @notice Builds `encodedTransaction` bytes in the exact layout the prover emits and `EvmV1Decoder`
///         expects, so unit tests exercise the real decoding path rather than a stub.
///
/// @dev Layout (from EvmV1Decoder): `abi.encode(uint8 txType, bytes[] chunks)`
///        chunk[0]     common fields  (nonce, gasLimit, from, toIsNull, to, value, data)
///        chunk[1]     type-specific  (legacy gasPrice / EIP-1559 params)
///        chunk[last]  receipt        (status, gasUsed, logs, logsBloom)
///      Types 0-2 carry three chunks; types 3-4 carry four.
library TxFixture {
    struct Log {
        address emitter;
        bytes32[] topics;
        bytes data;
    }

    /// @notice A legacy (type 0) transaction with a receipt.
    function legacy(
        address from,
        address to,
        uint256 value,
        uint8 status,
        uint64 gasUsed,
        uint128 gasPrice,
        Log[] memory logs
    ) internal pure returns (bytes memory) {
        bytes[] memory chunks = new bytes[](3);
        chunks[0] = abi.encode(uint64(1), uint64(21000), from, false, to, value, bytes(""));
        chunks[1] = abi.encode(gasPrice, uint256(27), bytes32(0), bytes32(0));
        chunks[2] = _receiptChunk(status, gasUsed, logs);
        return abi.encode(uint8(0), chunks);
    }

    /// @notice An EIP-1559 (type 2) transaction with a receipt.
    function eip1559(
        address from,
        address to,
        uint8 status,
        uint64 gasUsed,
        uint128 maxFeePerGas,
        Log[] memory logs
    ) internal pure returns (bytes memory) {
        bytes[] memory chunks = new bytes[](3);
        chunks[0] = abi.encode(uint64(7), uint64(200000), from, false, to, uint256(0), bytes(""));
        EvmV1Decoder.AccessListEntryBytes32[] memory accessList = new EvmV1Decoder.AccessListEntryBytes32[](0);
        chunks[1] = abi.encode(uint64(1), uint128(1 gwei), maxFeePerGas, accessList, uint8(0), bytes32(0), bytes32(0));
        chunks[2] = _receiptChunk(status, gasUsed, logs);
        return abi.encode(uint8(2), chunks);
    }

    /// @notice An EIP-2930 (type 1) transaction with a receipt.
    /// @dev Same three-chunk shape as legacy and 1559; only the type-specific chunk differs, laid out
    ///      per `EvmV1Decoder.Type1Fields`.
    function eip2930(address from, address to, uint8 status, uint64 gasUsed, uint128 gasPrice, Log[] memory logs)
        internal
        pure
        returns (bytes memory)
    {
        bytes[] memory chunks = new bytes[](3);
        chunks[0] = abi.encode(uint64(3), uint64(150000), from, false, to, uint256(0), bytes(""));
        EvmV1Decoder.AccessListEntryBytes32[] memory accessList = new EvmV1Decoder.AccessListEntryBytes32[](0);
        chunks[1] = abi.encode(uint64(1), gasPrice, accessList, uint8(0), bytes32(0), bytes32(0));
        chunks[2] = _receiptChunk(status, gasUsed, logs);
        return abi.encode(uint8(1), chunks);
    }

    /// @notice An EIP-4844 (type 3) transaction. Four chunks, and the receipt moves to chunk[3].
    /// @dev Used only to assert that the rules refuse what they cannot decode rather than guessing.
    function blobTx(address from, address to, uint8 status, uint64 gasUsed, Log[] memory logs)
        internal
        pure
        returns (bytes memory)
    {
        bytes[] memory chunks = new bytes[](4);
        chunks[0] = abi.encode(uint64(9), uint64(200000), from, false, to, uint256(0), bytes(""));
        EvmV1Decoder.AccessListEntryBytes32[] memory accessList = new EvmV1Decoder.AccessListEntryBytes32[](0);
        chunks[1] = abi.encode(uint64(1), uint128(1 gwei), uint128(30 gwei), accessList, uint8(0), bytes32(0), bytes32(0));
        chunks[2] = abi.encode(uint256(1 gwei), new bytes32[](0));
        chunks[3] = _receiptChunk(status, gasUsed, logs);
        return abi.encode(uint8(3), chunks);
    }

    function _receiptChunk(uint8 status, uint64 gasUsed, Log[] memory logs) private pure returns (bytes memory) {
        EvmV1Decoder.LogEntryTuple[] memory entries = new EvmV1Decoder.LogEntryTuple[](logs.length);
        for (uint256 i; i < logs.length; ++i) {
            entries[i] =
                EvmV1Decoder.LogEntryTuple({address_: logs[i].emitter, topics: logs[i].topics, data: logs[i].data});
        }
        return abi.encode(status, gasUsed, entries, bytes(""));
    }

    // ------------------------------------------------------------------ logs

    /// @notice Uniswap-V2 `Swap(address,uint256,uint256,uint256,uint256,address)`.
    function swapLog(address pool, uint256 a0In, uint256 a1In, uint256 a0Out, uint256 a1Out)
        internal
        pure
        returns (Log memory l)
    {
        bytes32[] memory topics = new bytes32[](3);
        topics[0] = keccak256("Swap(address,uint256,uint256,uint256,uint256,address)");
        topics[1] = bytes32(uint256(uint160(pool)));
        topics[2] = bytes32(uint256(uint160(pool)));
        l = Log({emitter: pool, topics: topics, data: abi.encode(a0In, a1In, a0Out, a1Out)});
    }

    /// @notice A custodian event: Locked / Unlocked / Minted / Burned, all `(address indexed, uint256)`.
    function amountLog(address emitter, string memory signature, address party, uint256 amount)
        internal
        pure
        returns (Log memory l)
    {
        bytes32[] memory topics = new bytes32[](2);
        topics[0] = keccak256(bytes(signature));
        topics[1] = bytes32(uint256(uint160(party)));
        l = Log({emitter: emitter, topics: topics, data: abi.encode(amount)});
    }

    /// @notice Chainlink `AnswerUpdated(int256 indexed,uint256 indexed,uint256)`.
    function answerUpdatedLog(address aggregator, int256 answer, uint256 roundId, uint256 updatedAt)
        internal
        pure
        returns (Log memory l)
    {
        bytes32[] memory topics = new bytes32[](3);
        topics[0] = keccak256("AnswerUpdated(int256,uint256,uint256)");
        topics[1] = bytes32(uint256(answer));
        topics[2] = bytes32(roundId);
        l = Log({emitter: aggregator, topics: topics, data: abi.encode(updatedAt)});
    }

    function logs0() internal pure returns (Log[] memory) {
        return new Log[](0);
    }

    function logs1(Log memory a) internal pure returns (Log[] memory out) {
        out = new Log[](1);
        out[0] = a;
    }

    function logs2(Log memory a, Log memory b) internal pure returns (Log[] memory out) {
        out = new Log[](2);
        out[0] = a;
        out[1] = b;
    }

    // --------------------------------------------------------------- proofs

    /// @notice Sibling path that the precompile (and our stateless mock) reads back as `index`.
    /// @dev Walking leaf-upward, a sibling on the left means this node was the right child, so bit
    ///      `k` of the index is set. `depth` is the Merkle tree height.
    function siblingsForIndex(uint32 index, uint8 depth)
        internal
        pure
        returns (INativeQueryVerifier.MerkleProofEntry[] memory siblings)
    {
        siblings = new INativeQueryVerifier.MerkleProofEntry[](depth);
        for (uint8 k; k < depth; ++k) {
            siblings[k] = INativeQueryVerifier.MerkleProofEntry({
                hash: keccak256(abi.encode("sibling", index, k)),
                isLeft: ((index >> k) & 1) == 1
            });
        }
    }
}
