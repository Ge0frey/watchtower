// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Shape of the evidence window a rule is allowed to inspect.
/// @dev Enforced by WatchtowerCore, never by the rule itself.
enum WindowShape {
    SINGLE_TX, // exactly one transaction
    INTRA_BLOCK_ADJACENT, // N transactions, same block, strictly consecutive txIndex
    SEQUENTIAL_STREAM // N transactions, strictly ascending (height, index), all beyond the cursor
}

/// @notice How a verdict reaches money.
/// @dev INSTANT claims are self-contained. OPTIMISTIC claims depend on stream completeness,
///      which cannot be proven on-chain, so they settle after a challenge window.
enum Settlement {
    INSTANT,
    OPTIMISTIC
}

/// @notice What a subject is, for display and for the shape of its accumulator.
enum SubjectKind {
    POOL, // a DEX pool or router on Ethereum
    CUSTODIAN, // a bridge / wrapped-asset issuer / RWA issuer
    FEED, // a price aggregator
    ACCOUNT // an individual address
}

/// @notice A source-chain transaction after the Block Prover Precompile has verified it.
/// @dev `txIndex` is produced by the precompile's own `calculateTxIndex`, never by us.
struct VerifiedTx {
    uint64 chainKey;
    uint64 blockHeight;
    uint32 txIndex;
    address from;
    address to;
    bool success; // receiptStatus == 1
    bytes encodedTx; // rules decode logs from this with EvmV1Decoder
}

/// @notice Read-only view of a subject's accumulator handed to a rule.
struct SubjectView {
    uint256 locked;
    uint256 minted;
    uint256 price; // last proven price, 8 decimals (Chainlink convention)
    uint64 cursorHeight;
    uint32 cursorIndex;
}

/// @notice Accumulator mutation a rule asks the core to apply.
/// @dev `price == 0` means "leave the price unchanged".
struct AccDelta {
    int256 lockedDelta;
    int256 mintedDelta;
    uint256 price;
    uint64 newHeight;
    uint32 newIndex;
}

/// @notice A rule's judgement. `damages` is denominated in USD with 8 decimals.
struct Verdict {
    bool violated;
    address beneficiary; // address(0) => the vault pays the subject's primary cover holder
    uint256 damages; // USD, 8 decimals
    bytes32 evidenceHash;
}
