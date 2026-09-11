// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IAttestedFeed
/// @notice Watchtower's accumulators, exposed as a read primitive for any other Creditcoin contract.
/// @dev Every value behind this interface was written only after the Block Prover Precompile verified
///      the source-chain transaction it came from. `latestProvenHead` is the exact coordinate the
///      subject has been verified up to - consumers can see precisely how current the state is.
interface IAttestedFeed {
    /// @return height Source-chain block height the subject is proven up to.
    /// @return index Transaction index within that block.
    function latestProvenHead(bytes32 subjectId) external view returns (uint64 height, uint32 index);

    /// @return locked Cumulative proven collateral locked on the source chain.
    /// @return minted Cumulative proven liabilities minted against it.
    function reserves(bytes32 subjectId) external view returns (uint256 locked, uint256 minted);

    /// @return answer Last proven price, 8 decimals.
    /// @return provenAtHeight Source-chain height the price was published in.
    function price(bytes32 subjectId) external view returns (uint256 answer, uint64 provenAtHeight);
}
