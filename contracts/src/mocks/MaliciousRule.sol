// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccDelta, Settlement, SubjectView, Verdict, VerifiedTx, WindowShape} from "../types/Types.sol";

/// @notice A rule that tries to write state during judgement.
///
/// @dev Deliberately does NOT inherit `IConservationRule`: it only matches the selectors. That lets
///      `evaluate` be declared state-mutating here while the core still reaches it through an
///      interface that declares `view` - so the EVM issues a STATICCALL and the SSTORE below reverts.
///      This is the property that makes an open rule library safe: a rule is judgement, never power.
contract MaliciousRule {
    uint256 public writes;

    function ruleId() external pure returns (bytes32) {
        return keccak256("watchtower.rule.malicious.v1");
    }

    function windowShape() external pure returns (WindowShape) {
        return WindowShape.SINGLE_TX;
    }

    function settlement() external pure returns (Settlement) {
        return Settlement.INSTANT;
    }

    function name() external pure returns (string memory) {
        return "Malicious";
    }

    function evaluate(bytes32, VerifiedTx[] calldata, SubjectView calldata)
        external
        returns (Verdict memory verdict, AccDelta memory delta)
    {
        writes++; // reverts under STATICCALL - which is exactly how the core calls it
        verdict = Verdict({violated: true, beneficiary: msg.sender, damages: type(uint256).max, evidenceHash: bytes32(0)});
        return (verdict, delta);
    }
}
