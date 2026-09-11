// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SubjectKind} from "../types/Types.sol";
import {SubjectKey} from "../libs/SubjectKey.sol";

/// @notice Everything Watchtower protects. A subject is the unit of cover, staking, bounties and
///         incidents - a DEX pool, a bridge, a custodian, a price aggregator.
struct Subject {
    SubjectKind kind;
    uint64 chainKey; // 1 = Ethereum Sepolia, 3 = Ethereum Mainnet
    address sourceContract; // the contract being watched, on Ethereum
    bytes32 boundRule;
    uint64 anchorHeight; // stream rules begin accumulating here
    uint32 anchorIndex;
    uint256 payoutCapPerBlock; // bounds rule bugs and griefing alike
    bytes32 priceSubject; // FEED subject whose proven answer denominates this subject's damages
    bool active;
    string label;
}

/// @title SubjectRegistry
/// @notice The catalogue: which risks exist, which rules may judge them, and what a mistake can cost.
/// @dev Owner-gated in v1. Rules are pure and payouts are capped, which is exactly what makes
///      permissionless rule submission safe later - the security model does not change, only the gate.
contract SubjectRegistry is Ownable {
    mapping(bytes32 => Subject) private _subjects;
    mapping(bytes32 => address) public ruleImpl;
    mapping(bytes32 => bool) public ruleAllowed;
    bytes32[] private _subjectIds;

    event RuleRegistered(bytes32 indexed ruleId, address impl, bool allowed);
    event SubjectRegistered(
        bytes32 indexed subjectId, uint64 indexed chainKey, address indexed sourceContract, bytes32 ruleId, string label
    );
    event SubjectPaused(bytes32 indexed subjectId, bool active);
    event PayoutCapSet(bytes32 indexed subjectId, uint256 cap);
    event PriceSubjectSet(bytes32 indexed subjectId, bytes32 indexed priceSubject);

    error UnknownSubject(bytes32 subjectId);
    error UnknownRule(bytes32 ruleId);
    error SubjectExists(bytes32 subjectId);

    constructor(address owner_) Ownable(owner_) {}

    function registerRule(bytes32 ruleId, address impl, bool allowed) external onlyOwner {
        ruleImpl[ruleId] = impl;
        ruleAllowed[ruleId] = allowed;
        emit RuleRegistered(ruleId, impl, allowed);
    }

    function registerSubject(
        SubjectKind kind,
        uint64 chainKey,
        address sourceContract,
        bytes32 ruleId,
        uint64 anchorHeight,
        uint32 anchorIndex,
        uint256 payoutCapPerBlock,
        string calldata label
    ) external onlyOwner returns (bytes32 subjectId) {
        if (!ruleAllowed[ruleId]) revert UnknownRule(ruleId);
        subjectId = SubjectKey.subjectId(chainKey, sourceContract, ruleId);
        if (_subjects[subjectId].sourceContract != address(0)) revert SubjectExists(subjectId);

        _subjects[subjectId] = Subject({
            kind: kind,
            chainKey: chainKey,
            sourceContract: sourceContract,
            boundRule: ruleId,
            anchorHeight: anchorHeight,
            anchorIndex: anchorIndex,
            payoutCapPerBlock: payoutCapPerBlock,
            priceSubject: bytes32(0),
            active: true,
            label: label
        });
        _subjectIds.push(subjectId);
        emit SubjectRegistered(subjectId, chainKey, sourceContract, ruleId, label);
    }

    function setSubjectActive(bytes32 subjectId, bool active) external onlyOwner {
        _requireSubject(subjectId);
        _subjects[subjectId].active = active;
        emit SubjectPaused(subjectId, active);
    }

    function setPayoutCap(bytes32 subjectId, uint256 cap) external onlyOwner {
        _requireSubject(subjectId);
        _subjects[subjectId].payoutCapPerBlock = cap;
        emit PayoutCapSet(subjectId, cap);
    }

    /// @notice Point a subject at the FEED subject that prices it.
    /// @dev Damages are judged in USD, and the only dollar figure Watchtower trusts is one it proved
    ///      itself. Linking subjects this way means a rule reads the price through the same
    ///      `IAttestedFeed` interface third parties use - Watchtower consumes its own primitive.
    function setPriceSubject(bytes32 subjectId, bytes32 priceSubjectId) external onlyOwner {
        _requireSubject(subjectId);
        _subjects[subjectId].priceSubject = priceSubjectId;
        emit PriceSubjectSet(subjectId, priceSubjectId);
    }

    function getSubject(bytes32 subjectId) external view returns (Subject memory) {
        _requireSubject(subjectId);
        return _subjects[subjectId];
    }

    function exists(bytes32 subjectId) external view returns (bool) {
        return _subjects[subjectId].sourceContract != address(0);
    }

    function payoutCap(bytes32 subjectId) external view returns (uint256) {
        return _subjects[subjectId].payoutCapPerBlock;
    }

    function subjectCount() external view returns (uint256) {
        return _subjectIds.length;
    }

    function subjectAt(uint256 i) external view returns (bytes32) {
        return _subjectIds[i];
    }

    /// @notice Whole catalogue in one call - the dashboard reads this and nothing else to enumerate.
    function allSubjects() external view returns (bytes32[] memory ids, Subject[] memory items) {
        ids = _subjectIds;
        items = new Subject[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            items[i] = _subjects[ids[i]];
        }
    }

    function _requireSubject(bytes32 subjectId) private view {
        if (_subjects[subjectId].sourceContract == address(0)) revert UnknownSubject(subjectId);
    }
}
