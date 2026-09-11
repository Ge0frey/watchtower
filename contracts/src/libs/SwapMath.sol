// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";

/// @title SwapMath
/// @notice Decoding and damages arithmetic for Uniswap-V2-style `Swap` logs.
library SwapMath {
    /// @dev keccak256("Swap(address,uint256,uint256,uint256,uint256,address)")
    ///      Computed at compile time from the literal, so it cannot drift from the ABI.
    bytes32 internal constant SWAP_V2 = keccak256("Swap(address,uint256,uint256,uint256,uint256,address)");

    struct Swap {
        bool found;
        uint256 amount0In;
        uint256 amount1In;
        uint256 amount0Out;
        uint256 amount1Out;
    }

    /// @notice First `Swap` log emitted by `pool` in this transaction's receipt.
    function firstSwapOn(bytes memory encodedTx, address pool) internal pure returns (Swap memory s) {
        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTx);
        EvmV1Decoder.LogEntry[] memory logs = EvmV1Decoder.getLogsByEventSignature(receipt, SWAP_V2);
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].address_ != pool) continue;
            if (logs[i].data.length < 128) continue;
            (s.amount0In, s.amount1In, s.amount0Out, s.amount1Out) =
                abi.decode(logs[i].data, (uint256, uint256, uint256, uint256));
            s.found = true;
            return s;
        }
    }

    /// @notice Round-trip profit the attacker realised on this pool, in units of the token they spent.
    ///
    /// @dev The damages model, stated plainly so it can be argued with:
    ///
    ///      A sandwich is a round trip. The searcher spends token A to buy token B immediately before
    ///      the victim, then sells B back for A immediately after. Whatever extra A they end up with
    ///      came out of the victim's execution price - there is no other source inside one block.
    ///
    ///          extracted = (A received in the back-run) - (A spent in the front-run)
    ///
    ///      This is a lower-bound proxy rather than a reconstruction of the victim's counterfactual
    ///      price: it ignores the pool fee the attacker paid, so it understates rather than
    ///      overstates the loss. It needs only the two `Swap` logs, which are themselves proven - no
    ///      reserve snapshot, no simulation, nothing a prosecutor could fabricate.
    ///
    /// @return side0 True when the attacker's input token was token0.
    /// @return extracted_ Profit in input-token units; zero if the round trip did not gain.
    function extracted(Swap memory front, Swap memory back) internal pure returns (bool side0, uint256 extracted_) {
        if (front.amount0In > 0) {
            side0 = true;
            extracted_ = back.amount0Out > front.amount0In ? back.amount0Out - front.amount0In : 0;
        } else if (front.amount1In > 0) {
            side0 = false;
            extracted_ = back.amount1Out > front.amount1In ? back.amount1Out - front.amount1In : 0;
        }
    }

    /// @notice True when `victim` swapped in the same direction the attacker front-ran.
    function sameDirection(Swap memory victim, bool side0) internal pure returns (bool) {
        return side0 ? victim.amount0In > 0 : victim.amount1In > 0;
    }

    /// @notice Token amount -> USD with 8 decimals, given an 8-decimal price.
    function toUsdE8(uint256 amount, uint256 priceE8, uint8 tokenDecimals) internal pure returns (uint256) {
        if (priceE8 == 0) return 0;
        return (amount * priceE8) / (10 ** tokenDecimals);
    }
}
