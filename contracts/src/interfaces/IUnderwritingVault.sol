// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IUnderwritingVault
/// @notice Cover, staking, bounties and bonds. The only contract that moves money.
interface IUnderwritingVault {
    /// @notice Pay a proven verdict: restitution to the beneficiary, bounty to the prosecutor.
    /// @param damagesUsd Damages in USD with 8 decimals, as judged by the rule.
    /// @param continuityLength Number of continuity roots in the proof; prices the bounty, because
    ///        it is the same quantity the chain charges gas for.
    /// @return paid Restitution actually transferred (may be capped, or zero if uncovered).
    /// @return bounty Prosecutor bounty actually transferred.
    function settle(
        bytes32 incidentId,
        bytes32 subjectId,
        address beneficiary,
        uint256 damagesUsd,
        address prosecutor,
        uint64 continuityLength
    ) external returns (uint256 paid, uint256 bounty);

    /// @notice Escrow a prosecutor's bond for an optimistic incident.
    function postBond(bytes32 incidentId, address prosecutor) external payable;

    /// @notice Return a bond once the challenge window closes untouched.
    function releaseBond(bytes32 incidentId) external;

    /// @notice Award a bond to whoever proved the prosecutor's stream had a gap.
    function slashBond(bytes32 incidentId, address challenger) external;

    /// @notice Block unstaking while a subject has an unresolved breach.
    function setFrozen(bytes32 subjectId, bool frozen) external;

    /// @notice Cover currently held by `holder` on `subjectId`, in USD with 8 decimals.
    function coverOf(bytes32 subjectId, address holder) external view returns (uint256);

    /// @notice The address the vault pays when a rule returns no explicit beneficiary.
    function primaryHolder(bytes32 subjectId) external view returns (address);
}
