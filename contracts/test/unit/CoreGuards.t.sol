// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Base} from "../Base.t.sol";
import {WatchtowerCore} from "../../src/core/WatchtowerCore.sol";
import {SubjectRegistry} from "../../src/core/SubjectRegistry.sol";
import {EvidenceInput} from "../../src/interfaces/IWatchtowerCore.sol";
import {EvidenceLib} from "../../src/libs/EvidenceLib.sol";
import {MaliciousRule} from "../../src/mocks/MaliciousRule.sol";
import {SubjectKey} from "../../src/libs/SubjectKey.sol";
import {SubjectKind} from "../../src/types/Types.sol";
import {TxFixture} from "../TxFixture.sol";

/// @notice The guards that stand between an untrusted worker and the vault.
contract CoreGuardsTest is Base {
    address internal bridgeUser = makeAddr("bridgeUser");

    function _lockTx(uint256 amount) internal view returns (bytes memory) {
        return TxFixture.legacy(
            bridgeUser, bridge, 0, 1, 90000, 15 gwei,
            TxFixture.logs1(TxFixture.amountLog(bridge, "Locked(address,uint256)", bridgeUser, amount))
        );
    }

    /// @notice The same coordinate cannot be filed twice under the same rule.
    /// @dev Tested on a SINGLE_TX rule on purpose: stream rules are also protected by the cursor,
    ///      which would mask the replay guard. Here the guard is the only thing standing in the way.
    function test_replayGuardRejectsDuplicateEvidence() public {
        bytes memory reverted =
            TxFixture.legacy(bridgeUser, address(0xBEEF), 0, 0, 50_000, 10 gwei, TxFixture.logs0());
        EvidenceInput memory input =
            singleEvidence(accountSubject, failedTx.ruleId(), SEPOLIA, 700, 5, reverted, 10);

        vm.prank(prosecutor);
        core.submitEvidence(input);

        bytes32 key = SubjectKey.evidenceKey(failedTx.ruleId(), accountSubject, SEPOLIA, 700, 5);
        vm.prank(prosecutor);
        vm.expectRevert(abi.encodeWithSelector(WatchtowerCore.AlreadyConsumed.selector, key));
        core.submitEvidence(input);
    }

    /// @notice A stream rule is guarded twice over: the cursor rejects the rewind before the replay
    ///         guard is ever consulted.
    function test_streamDuplicateIsCaughtByTheCursor() public {
        EvidenceInput memory input =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, 1001, 2, _lockTx(1 ether), 10);

        vm.prank(prosecutor);
        core.submitEvidence(input);

        vm.prank(prosecutor);
        vm.expectRevert(EvidenceLib.CursorRegression.selector);
        core.submitEvidence(input);
    }

    /// @notice ...but the guard is rule-scoped, so one Ethereum transaction can be evidence for
    ///         several risks at once. A global guard - as the protocol's own reference ASC uses -
    ///         would make Watchtower's rule library impossible.
    function test_replayGuardIsRuleScoped() public {
        EvidenceInput memory streamInput =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, 1001, 2, _lockTx(1 ether), 10);
        vm.prank(prosecutor);
        core.submitEvidence(streamInput);

        // Same chain, same height, same index - different subject and rule. Allowed.
        bytes memory reverted =
            TxFixture.legacy(bridgeUser, address(0xBEEF), 0, 0, 50_000, 10 gwei, TxFixture.logs0());
        EvidenceInput memory failedInput =
            singleEvidence(accountSubject, failedTx.ruleId(), SEPOLIA, 1001, 2, reverted, 10);
        vm.prank(prosecutor);
        core.submitEvidence(failedInput);

        (uint256 locked,) = core.reserves(bridgeSubject);
        assertEq(locked, 1 ether);
    }

    /// @notice A proof the precompile refuses is not evidence, whatever the worker claims.
    function test_revertsWhenVerificationFails() public {
        EvidenceInput memory input =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, 1001, 2, _lockTx(1 ether), 10);
        input.merkleRoots[0] = bytes32(0); // the mock treats a zero root as unverifiable

        vm.prank(prosecutor);
        vm.expectRevert(WatchtowerCore.VerificationFailed.selector);
        core.submitEvidence(input);
    }

    function test_rejectsMismatchedArrayLengths() public {
        EvidenceInput memory input =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, 1001, 2, _lockTx(1 ether), 10);
        input.blockHeights = new uint64[](2);

        vm.prank(prosecutor);
        vm.expectRevert(WatchtowerCore.MalformedInput.selector);
        core.submitEvidence(input);
    }

    /// @notice The protocol's batch ceiling is ten transactions sharing one continuity proof.
    function test_rejectsWindowLargerThanBatchCeiling() public {
        uint64[] memory heights = new uint64[](11);
        uint32[] memory indices = new uint32[](11);
        bytes[] memory txs = new bytes[](11);
        for (uint256 i; i < 11; ++i) {
            heights[i] = uint64(1010 + i);
            indices[i] = uint32(i);
            txs[i] = _lockTx(1 ether);
        }
        EvidenceInput memory input = evidence(bridgeSubject, reserve.ruleId(), SEPOLIA, heights, indices, txs, 10);

        vm.prank(prosecutor);
        vm.expectRevert(WatchtowerCore.MalformedInput.selector);
        core.submitEvidence(input);
    }

    function test_rejectsRuleNotBoundToSubject() public {
        EvidenceInput memory input =
            singleEvidence(bridgeSubject, failedTx.ruleId(), SEPOLIA, 1001, 2, _lockTx(1 ether), 10);

        vm.prank(prosecutor);
        vm.expectRevert(WatchtowerCore.RuleMismatch.selector);
        core.submitEvidence(input);
    }

    function test_rejectsWrongChainKey() public {
        EvidenceInput memory input =
            singleEvidence(bridgeSubject, reserve.ruleId(), MAINNET, 1001, 2, _lockTx(1 ether), 10);

        vm.prank(prosecutor);
        vm.expectRevert(WatchtowerCore.ChainKeyMismatch.selector);
        core.submitEvidence(input);
    }

    function test_rejectsPausedSubject() public {
        vm.prank(owner);
        registry.setSubjectActive(bridgeSubject, false);

        EvidenceInput memory input =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, 1001, 2, _lockTx(1 ether), 10);
        vm.prank(prosecutor);
        vm.expectRevert(WatchtowerCore.SubjectInactive.selector);
        core.submitEvidence(input);
    }

    function test_rejectsDisabledRule() public {
        bytes32 rid = reserve.ruleId(); // resolve before pranking: an external call would consume it
        vm.prank(owner);
        registry.registerRule(rid, address(reserve), false);

        EvidenceInput memory input =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, 1001, 2, _lockTx(1 ether), 10);
        vm.prank(prosecutor);
        vm.expectRevert(abi.encodeWithSelector(WatchtowerCore.RuleNotAllowed.selector, reserve.ruleId()));
        core.submitEvidence(input);
    }

    function test_unknownSubjectReverts() public {
        bytes32 ghost = keccak256("no such subject");
        EvidenceInput memory input =
            singleEvidence(ghost, reserve.ruleId(), SEPOLIA, 1001, 2, _lockTx(1 ether), 10);

        vm.prank(prosecutor);
        vm.expectRevert(abi.encodeWithSelector(SubjectRegistry.UnknownSubject.selector, ghost));
        core.submitEvidence(input);
    }

    /// @notice Value sent with a submission that opens no breach comes straight back.
    function test_refundsValueWhenNoBreachOpens() public {
        EvidenceInput memory input =
            singleEvidence(bridgeSubject, reserve.ruleId(), SEPOLIA, 1001, 2, _lockTx(1 ether), 10);

        uint256 before = prosecutor.balance;
        vm.prank(prosecutor);
        core.submitEvidence{value: 0.5 ether}(input);
        assertEq(prosecutor.balance, before, "bond refunded when nothing was claimed");
    }

    /// @notice A rule cannot be a back door into the vault. `evaluate` is declared `view` on the
    ///         interface, so the core reaches it by STATICCALL - and a rule that tries to write, or
    ///         to award itself the maximum possible damages, simply reverts before any money moves.
    function test_maliciousRuleCannotMutateStateOrDrainVault() public {
        MaliciousRule evil = new MaliciousRule();
        bytes32 evilId = evil.ruleId();

        vm.startPrank(owner);
        registry.registerRule(evilId, address(evil), true);
        bytes32 evilSubject = registry.registerSubject(
            SubjectKind.ACCOUNT, SEPOLIA, address(0xDEAD), evilId, 0, 0, 100 ether, "Hostile rule"
        );
        vm.stopPrank();

        vm.deal(address(vault), 500 ether);
        uint256 vaultBefore = address(vault).balance;

        EvidenceInput memory input =
            singleEvidence(evilSubject, evilId, SEPOLIA, 900, 1, _lockTx(1 ether), 10);

        vm.prank(prosecutor);
        vm.expectRevert(); // STATICCALL violation: the rule never gets to judge
        core.submitEvidence(input);

        assertEq(address(vault).balance, vaultBefore, "not a wei moved");
        assertEq(evil.writes(), 0, "the rule never wrote anything either");
    }
}
