// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";
import {IAttestedFeed} from "../interfaces/IAttestedFeed.sol";
import {IConservationRule} from "../interfaces/IConservationRule.sol";
import {PriceLib} from "../libs/PriceLib.sol";
import {Subject, SubjectRegistry} from "../core/SubjectRegistry.sol";
import {EvidenceLib} from "../libs/EvidenceLib.sol";
import {SwapMath} from "../libs/SwapMath.sol";
import {AccDelta, Settlement, SubjectView, Verdict, VerifiedTx, WindowShape} from "../types/Types.sol";

/// @title FailedTx
/// @notice Reimburses gas burned by a reverted Ethereum transaction.
///
/// @dev Every ASC in the protocol's documentation asserts `receiptStatus == 1`, because the Block
///      Prover Precompile proves inclusion, not success. This rule is that warning read backwards:
///      it is the one place in Watchtower that asserts `receiptStatus == 0`, and it keeps that
///      inversion local - the core still refuses to reason about failed transactions anywhere else.
///
///      The whole rule is about sixty lines. That is the point: the engine is the product, and a new
///      risk is a pure function.
contract FailedTx is IConservationRule {
    uint8 internal constant ETH_DECIMALS = 18;

    error UnsupportedTxType(uint8 txType);

    SubjectRegistry public immutable REGISTRY;
    IAttestedFeed public immutable FEED_SOURCE;

    constructor(SubjectRegistry registry_, IAttestedFeed feedSource_) {
        REGISTRY = registry_;
        FEED_SOURCE = feedSource_;
    }

    function ruleId() external pure override returns (bytes32) {
        return keccak256("watchtower.rule.failed-tx.v1");
    }

    function windowShape() external pure override returns (WindowShape) {
        return WindowShape.SINGLE_TX;
    }

    function settlement() external pure override returns (Settlement) {
        return Settlement.INSTANT;
    }

    function name() external pure override returns (string memory) {
        return "FailedTx";
    }

    /// @inheritdoc IConservationRule
    function evaluate(bytes32 subjectId, VerifiedTx[] calldata window, SubjectView calldata state)
        external
        view
        override
        returns (Verdict memory verdict, AccDelta memory delta)
    {
        delta; // a single-transaction claim moves no accumulator

        VerifiedTx calldata t = window[0];
        if (t.success) return (verdict, delta); // deliberately inverted: we pay for FAILURE

        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(t.encodedTx);
        uint256 gasPrice = _gasPrice(t.encodedTx);
        uint256 burnedWei = uint256(receipt.receiptGasUsed) * gasPrice;

        verdict = Verdict({
            violated: true,
            beneficiary: t.from,
            damages: SwapMath.toUsdE8(burnedWei, PriceLib.resolve(FEED_SOURCE, REGISTRY.getSubject(subjectId), state), ETH_DECIMALS),
            evidenceHash: keccak256(abi.encode(t.chainKey, t.blockHeight, t.txIndex))
        });
    }

    /// @dev Gas price lives in the type-specific chunk, not the receipt. For EIP-1559 transactions the
    ///      encoding carries `maxFeePerGas` rather than the effective price, so the reimbursement is
    ///      an upper bound - stated here rather than buried, and capped by the policy either way.
    ///
    ///      Types 0, 1 and 2 are every transaction a user actually sends and sees revert. The decoder
    ///      ships helpers for 0 and 2 only, so type 1 (EIP-2930) is read from its chunk directly
    ///      against the library's own `Type1Fields` layout. Types 3 and 4 carry a fourth chunk whose
    ///      split the decoder does not expose, so they are refused loudly rather than mis-read: a
    ///      blob or delegation transaction would otherwise be reimbursed from the wrong field.
    function _gasPrice(bytes memory encodedTx) private pure returns (uint256) {
        uint8 txType = EvmV1Decoder.getTransactionType(encodedTx);
        if (txType == 0) {
            return uint256(EvmV1Decoder.decodeTransactionType0(encodedTx).type0.gasPrice);
        }
        if (txType == 2) {
            return uint256(EvmV1Decoder.decodeTransactionType2(encodedTx).type2.maxFeePerGas);
        }
        if (txType == 1) {
            (, bytes[] memory chunks) = abi.decode(encodedTx, (uint8, bytes[]));
            if (chunks.length != 3) revert UnsupportedTxType(txType);
            (, uint128 gasPrice,,,,) = abi.decode(
                chunks[1],
                (uint64, uint128, EvmV1Decoder.AccessListEntryBytes32[], uint8, bytes32, bytes32)
            );
            return uint256(gasPrice);
        }
        revert UnsupportedTxType(txType);
    }
}
