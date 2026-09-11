// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {INativeQueryVerifier} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";
import {Verdict} from "../types/Types.sol";

/// @notice One evidence submission. Bundled into a struct so the ABI stays readable and the
///         implementation stays under the stack limit.
/// @dev `merkleRoots[i]` and `siblings[i]` together form the Merkle proof for `encodedTxs[i]` at
///      `blockHeights[i]`. The continuity proof is SHARED by the whole window - that is the shape
///      the Block Prover Precompile's batch overload expects.
struct EvidenceInput {
    bytes32 subjectId;
    bytes32 ruleId;
    uint64 chainKey;
    uint64[] blockHeights;
    bytes[] encodedTxs;
    bytes32[] merkleRoots;
    INativeQueryVerifier.MerkleProofEntry[][] siblings;
    bytes32 lowerEndpointDigest;
    bytes32[] continuityRoots;
}

/// @title IWatchtowerCore
/// @notice The Attestcoin Smart Contract: the only contract that speaks to the precompile.
interface IWatchtowerCore {
    function submitEvidence(EvidenceInput calldata input) external payable returns (bytes32 incidentId);

    function previewEvidence(EvidenceInput calldata input)
        external
        view
        returns (bool verified, Verdict memory verdict);

    function settleBreach(bytes32 incidentId) external;

    function challengeGap(bytes32 incidentId, EvidenceInput calldata gapEvidence) external;
}
