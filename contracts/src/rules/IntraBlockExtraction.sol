// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAttestedFeed} from "../interfaces/IAttestedFeed.sol";
import {IConservationRule} from "../interfaces/IConservationRule.sol";
import {PriceLib} from "../libs/PriceLib.sol";
import {EvidenceLib} from "../libs/EvidenceLib.sol";
import {SwapMath} from "../libs/SwapMath.sol";
import {Subject, SubjectRegistry} from "../core/SubjectRegistry.sol";
import {AccDelta, Settlement, SubjectView, Verdict, VerifiedTx, WindowShape} from "../types/Types.sol";

/// @title IntraBlockExtraction
/// @notice Proves a sandwich: a searcher bracketing a victim's swap at consecutive positions inside
///         one Ethereum block, on one pool.
///
/// @dev This is the rule that cannot exist on Ethereum. A contract there cannot see the transactions
///      beside it in its own block, so the fact this rule turns on - adjacency - is unreachable from
///      inside the source chain. On Creditcoin the Block Prover Precompile hands us each
///      transaction's index, the core asserts the three are consecutive, and what was previously
///      forensic commentary becomes an on-chain verdict with money attached.
///
///      Settles INSTANT: the three proofs are the entire claim. Nothing outside the window can
///      change the judgement, so there is nothing to challenge.
contract IntraBlockExtraction is IConservationRule {
    using EvidenceLib for VerifiedTx[];

    SubjectRegistry public immutable REGISTRY;
    IAttestedFeed public immutable FEED_SOURCE;

    /// @notice Decimals of the token this rule is able to price.
    uint8 public immutable TOKEN_DECIMALS;

    /// @notice Which side of the pair the priced token sits on.
    ///
    /// @dev A pool has two tokens and the linked feed prices exactly one of them. On the canonical
    ///      Uniswap V2 USDC/WETH pair, token0 is USDC (6 decimals) and token1 is WETH (18) - so an
    ///      ETH/USD feed can price a searcher's round trip only when the searcher spent WETH. A
    ///      sandwich run in the other direction is real, but this instance cannot put a number on it,
    ///      and it declines rather than reporting a figure that is wrong by twelve orders of
    ///      magnitude. Deploy a second instance with the USDC-side configuration to cover it.
    bool public immutable PRICED_SIDE_IS_TOKEN0;

    constructor(
        SubjectRegistry registry_,
        IAttestedFeed feedSource_,
        uint8 tokenDecimals_,
        bool pricedSideIsToken0_
    ) {
        REGISTRY = registry_;
        FEED_SOURCE = feedSource_;
        TOKEN_DECIMALS = tokenDecimals_;
        PRICED_SIDE_IS_TOKEN0 = pricedSideIsToken0_;
    }

    function ruleId() external pure override returns (bytes32) {
        return keccak256("watchtower.rule.intra-block-extraction.v1");
    }

    function windowShape() external pure override returns (WindowShape) {
        return WindowShape.INTRA_BLOCK_ADJACENT;
    }

    function settlement() external pure override returns (Settlement) {
        return Settlement.INSTANT;
    }

    function name() external pure override returns (string memory) {
        return "IntraBlockExtraction";
    }

    /// @inheritdoc IConservationRule
    function evaluate(bytes32 subjectId, VerifiedTx[] calldata window, SubjectView calldata state)
        external
        view
        override
        returns (Verdict memory verdict, AccDelta memory delta)
    {
        // An intra-block rule never advances the cursor: it reads a neighbourhood, not a stream.
        delta;

        if (window.length != 3) return (verdict, delta);
        if (!window[0].success || !window[1].success || !window[2].success) return (verdict, delta);

        // Same searcher on both sides of the victim, and the victim is somebody else.
        address attacker = window[0].from;
        if (window[2].from != attacker) return (verdict, delta);
        address victim = window[1].from;
        if (victim == attacker) return (verdict, delta);

        Subject memory subject = REGISTRY.getSubject(subjectId);
        address pool = subject.sourceContract;

        SwapMath.Swap memory front = SwapMath.firstSwapOn(window[0].encodedTx, pool);
        SwapMath.Swap memory mid = SwapMath.firstSwapOn(window[1].encodedTx, pool);
        SwapMath.Swap memory back = SwapMath.firstSwapOn(window[2].encodedTx, pool);
        if (!front.found || !mid.found || !back.found) return (verdict, delta);

        (bool side0, uint256 profit) = SwapMath.extracted(front, back);
        if (profit == 0) return (verdict, delta);
        if (!SwapMath.sameDirection(mid, side0)) return (verdict, delta);

        // The extracted amount is denominated in the token the searcher spent. Only judge it when
        // that is the token this instance can actually price.
        if (side0 != PRICED_SIDE_IS_TOKEN0) return (verdict, delta);

        verdict = Verdict({
            violated: true,
            beneficiary: victim,
            damages: SwapMath.toUsdE8(profit, PriceLib.resolve(FEED_SOURCE, subject, state), TOKEN_DECIMALS),
            evidenceHash: _fingerprint(window)
        });
    }

    function _fingerprint(VerifiedTx[] calldata window) private pure returns (bytes32) {
        VerifiedTx[] memory copy = window;
        return EvidenceLib.fingerprint(copy);
    }
}
