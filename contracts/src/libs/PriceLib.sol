// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAttestedFeed} from "../interfaces/IAttestedFeed.sol";
import {Subject} from "../core/SubjectRegistry.sol";
import {SubjectView} from "../types/Types.sol";

/// @title PriceLib
/// @notice Resolves the dollar price a rule should judge damages with.
/// @dev Rules never take a price as an argument and never call an oracle. They read it through
///      `IAttestedFeed` - the same read interface Watchtower exposes to any other Creditcoin
///      contract - so every dollar figure in a verdict traces back to a Chainlink answer this system
///      proved for itself with the Block Prover Precompile.
library PriceLib {
    function resolve(IAttestedFeed feedSource, Subject memory subject, SubjectView memory state)
        internal
        view
        returns (uint256 priceE8)
    {
        if (subject.priceSubject != bytes32(0) && address(feedSource) != address(0)) {
            (priceE8,) = feedSource.price(subject.priceSubject);
            if (priceE8 != 0) return priceE8;
        }
        return state.price; // a subject may carry its own proven price instead
    }
}
