// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IUnderwritingVault} from "../interfaces/IUnderwritingVault.sol";
import {SubjectRegistry} from "./SubjectRegistry.sol";

/// @notice Capital staked against one subject's risk.
struct Tranche {
    uint256 staked;
    uint256 premiums;
    uint256 paidOut;
}

/// @notice Cover bought by one address on one subject. Denominated in USD, 8 decimals.
struct Policy {
    address holder;
    bytes32 subjectId;
    uint256 coverUsd;
    uint64 expiry;
    uint256 premiumPaid;
    bool active;
}

/// @title UnderwritingVault
/// @notice The only contract in Watchtower that moves money.
/// @dev Rules judge, the core verifies, the vault pays. Payouts are bounded three ways at once -
///      by the holder's cover, by the subject's staked tranche, and by the registry's per-block cap.
contract UnderwritingVault is IUnderwritingVault, Ownable, ReentrancyGuard {
    /// @notice Demo-time conversion from USD (8 decimals) to CTC wei.
    /// @dev Watchtower prices damages in dollars because that is how the proven Chainlink answer is
    ///      denominated, but it settles in CTC. In production this becomes a CTC/USD feed - itself
    ///      just another ChainlinkFeed subject. Documented as a v1 simplification.
    uint256 public usdPerCtcE8 = 1e8; // 1 CTC = $1.00 for the testnet demo

    /// @notice Base prosecutor bounty before the freshness multiplier.
    uint256 public baseBounty = 0.05 ether;

    /// @notice Bond a prosecutor must escrow to open an optimistic breach.
    uint256 public requiredBond = 0.1 ether;

    /// @notice Freshness tiers, measured in CONTINUITY PROOF LENGTH rather than wall-clock age.
    /// @dev The number of continuity roots in a proof is exactly the protocol's cost driver: recent
    ///      evidence sits ~10 blocks from a live attestation, while evidence older than the 24-hour
    ///      checkpoint cliff needs ~1000 hashes and costs roughly 10x more gas. Reading freshness off
    ///      the proof itself means the bounty schedule is derived from the same quantity the chain
    ///      actually charges for - no oracle, no timestamp, nothing to game.
    uint64 public constant FRESH_CONTINUITY = 100;
    uint64 public constant STALE_CONTINUITY = 900;

    SubjectRegistry public immutable REGISTRY;
    address public core;

    mapping(bytes32 => Tranche) public tranches;
    mapping(bytes32 => mapping(address => uint256)) public stakeOf;

    /// @notice Sum of every underwriter's stake on a subject.
    /// @dev Deliberately NOT the same quantity as `Tranche.staked`. A payout reduces the tranche but
    ///      not anybody's individual position, so the two diverge the moment a claim is paid.
    ///      Premiums are shared over the positions that actually exist, which is what keeps each
    ///      underwriter's entitlement proportional to what they put in.
    mapping(bytes32 => uint256) public totalShares;

    /// @notice Premium accrued per unit of stake, scaled by 1e18.
    mapping(bytes32 => uint256) public premiumPerShare;
    mapping(bytes32 => mapping(address => uint256)) private _premiumDebt;

    /// @notice Premiums paid on a subject nobody was underwriting yet.
    mapping(bytes32 => uint256) public unallocatedPremiums;

    uint256 private constant ACC_PRECISION = 1e18;

    mapping(bytes32 => uint256) public bountyPool;
    mapping(bytes32 => bool) public frozen;
    mapping(bytes32 => address) public override primaryHolder;

    mapping(uint256 => Policy) public policies;
    mapping(bytes32 => mapping(address => uint256)) public policyIdOf;
    uint256 public nextPolicyId = 1;

    mapping(bytes32 => uint256) public bondOf;
    mapping(bytes32 => address) public bondPoster;

    mapping(bytes32 => mapping(uint256 => uint256)) public paidInBlock;

    event CoverBought(bytes32 indexed subjectId, address indexed holder, uint256 coverUsd, uint64 expiry, uint256 premium);
    event Staked(bytes32 indexed subjectId, address indexed staker, uint256 amount);
    event Unstaked(bytes32 indexed subjectId, address indexed staker, uint256 amount);
    event PremiumsClaimed(bytes32 indexed subjectId, address indexed staker, uint256 amount);
    event WatchFunded(bytes32 indexed subjectId, address indexed funder, uint256 amount);
    event Settled(
        bytes32 indexed incidentId,
        bytes32 indexed subjectId,
        address indexed beneficiary,
        uint256 damagesUsd,
        uint256 paid,
        address prosecutor,
        uint256 bounty
    );
    event BondPosted(bytes32 indexed incidentId, address indexed prosecutor, uint256 amount);
    event BondReleased(bytes32 indexed incidentId, address indexed prosecutor, uint256 amount);
    event BondSlashed(bytes32 indexed incidentId, address indexed challenger, uint256 amount);
    event FrozenSet(bytes32 indexed subjectId, bool frozen);
    event ParamsSet(uint256 usdPerCtcE8, uint256 baseBounty, uint256 requiredBond);

    error NotCore();
    error SubjectFrozen();
    error InsufficientStake();
    error PremiumTooLow(uint256 required);
    error BondAlreadyPosted();
    error TransferFailed();

    modifier onlyCore() {
        if (msg.sender != core) revert NotCore();
        _;
    }

    constructor(address owner_, SubjectRegistry registry_) Ownable(owner_) {
        REGISTRY = registry_;
    }

    function setCore(address core_) external onlyOwner {
        core = core_;
    }

    function setParams(uint256 usdPerCtcE8_, uint256 baseBounty_, uint256 requiredBond_) external onlyOwner {
        usdPerCtcE8 = usdPerCtcE8_;
        baseBounty = baseBounty_;
        requiredBond = requiredBond_;
        emit ParamsSet(usdPerCtcE8_, baseBounty_, requiredBond_);
    }

    // ---------------------------------------------------------------- cover

    /// @notice Buy cover on a subject. Premium is 1% of cover per 30 days, paid in CTC.
    /// @param coverUsd Maximum restitution, in USD with 8 decimals.
    function buyCover(bytes32 subjectId, uint256 coverUsd, uint64 duration) external payable nonReentrant {
        uint256 coverCtc = usdToCtc(coverUsd);
        uint256 required = (coverCtc * 1 * duration) / (100 * 30 days);
        if (msg.value < required) revert PremiumTooLow(required);

        uint256 id = policyIdOf[subjectId][msg.sender];
        if (id == 0) {
            id = nextPolicyId++;
            policyIdOf[subjectId][msg.sender] = id;
            if (primaryHolder[subjectId] == address(0)) primaryHolder[subjectId] = msg.sender;
        }
        policies[id] = Policy({
            holder: msg.sender,
            subjectId: subjectId,
            coverUsd: coverUsd,
            expiry: uint64(block.timestamp) + duration,
            premiumPaid: policies[id].premiumPaid + msg.value,
            active: true
        });

        tranches[subjectId].premiums += msg.value;
        _accruePremium(subjectId, msg.value);
        emit CoverBought(subjectId, msg.sender, coverUsd, policies[id].expiry, msg.value);
    }

    function coverOf(bytes32 subjectId, address holder) public view override returns (uint256) {
        uint256 id = policyIdOf[subjectId][holder];
        if (id == 0) return 0;
        Policy storage p = policies[id];
        if (!p.active || p.expiry < block.timestamp) return 0;
        return p.coverUsd;
    }

    // ------------------------------------------------------------ liquidity

    function stake(bytes32 subjectId) external payable nonReentrant {
        uint256 owed = _settlePremiums(subjectId, msg.sender);
        tranches[subjectId].staked += msg.value;
        stakeOf[subjectId][msg.sender] += msg.value;
        totalShares[subjectId] += msg.value;
        _resetDebt(subjectId, msg.sender);
        emit Staked(subjectId, msg.sender, msg.value);
        if (owed > 0) _send(msg.sender, owed);
    }

    /// @notice Withdraw stake. Blocked while the subject has an unresolved breach - underwriters
    ///         cannot exit between a proven violation and its settlement.
    function unstake(bytes32 subjectId, uint256 amount) external nonReentrant {
        if (frozen[subjectId]) revert SubjectFrozen();
        if (stakeOf[subjectId][msg.sender] < amount || tranches[subjectId].staked < amount) revert InsufficientStake();
        uint256 owed = _settlePremiums(subjectId, msg.sender);
        stakeOf[subjectId][msg.sender] -= amount;
        tranches[subjectId].staked -= amount;
        totalShares[subjectId] -= amount;
        _resetDebt(subjectId, msg.sender);
        _send(msg.sender, amount + owed);
        emit Unstaked(subjectId, msg.sender, amount);
    }

    /// @notice Collect the premiums your stake has earned, without touching the stake itself.
    /// @dev Underwriting is only a business if the income actually arrives. Premiums accrue per unit
    ///      of stake at the moment cover is bought, so an underwriter earns from the policies written
    ///      while they were backing the subject and nothing from the ones written before they staked.
    function claimPremiums(bytes32 subjectId) external nonReentrant returns (uint256 amount) {
        amount = _settlePremiums(subjectId, msg.sender);
        _resetDebt(subjectId, msg.sender);
        if (amount == 0) return 0;
        _send(msg.sender, amount);
    }

    /// @notice Premiums `staker` could claim on `subjectId` right now.
    function claimablePremiums(bytes32 subjectId, address staker) public view returns (uint256) {
        uint256 accrued = (stakeOf[subjectId][staker] * premiumPerShare[subjectId]) / ACC_PRECISION;
        uint256 debt = _premiumDebt[subjectId][staker];
        return accrued > debt ? accrued - debt : 0;
    }

    /// @dev Splits `amount` across the stake that exists right now. With nothing staked there is
    ///      nobody to pay, so the premium is parked rather than silently credited to whoever stakes
    ///      next - that would pay an underwriter for risk they never carried.
    function _accruePremium(bytes32 subjectId, uint256 amount) private {
        uint256 shares = totalShares[subjectId];
        if (shares == 0) {
            unallocatedPremiums[subjectId] += amount;
            return;
        }
        premiumPerShare[subjectId] += (amount * ACC_PRECISION) / shares;
    }

    /// @dev Books what is owed and emits the claim. The transfer is the caller's job, after its own
    ///      state is settled - never before.
    function _settlePremiums(bytes32 subjectId, address staker) private returns (uint256 amount) {
        amount = claimablePremiums(subjectId, staker);
        if (amount == 0) return 0;
        // `Tranche.premiums` stays cumulative - it is the subject's lifetime income, not a balance.
        // Double-claiming is prevented by the per-staker debt, not by draining a counter.
        emit PremiumsClaimed(subjectId, staker, amount);
    }

    function _resetDebt(bytes32 subjectId, address staker) private {
        _premiumDebt[subjectId][staker] =
            (stakeOf[subjectId][staker] * premiumPerShare[subjectId]) / ACC_PRECISION;
    }

    /// @notice Put a bounty on any subject. This is what makes "permissionless prosecutors" a market
    ///         rather than an architectural claim: anyone can pay to have a contract watched.
    function fundWatch(bytes32 subjectId) external payable {
        bountyPool[subjectId] += msg.value;
        emit WatchFunded(subjectId, msg.sender, msg.value);
    }

    // ------------------------------------------------------------ settlement

    function settle(
        bytes32 incidentId,
        bytes32 subjectId,
        address beneficiary,
        uint256 damagesUsd,
        address prosecutor,
        uint64 continuityLength
    ) external override onlyCore nonReentrant returns (uint256 paid, uint256 bounty) {
        address payee = beneficiary == address(0) ? primaryHolder[subjectId] : beneficiary;

        if (payee != address(0)) {
            uint256 capUsd = coverOf(subjectId, payee);
            uint256 claimUsd = damagesUsd < capUsd ? damagesUsd : capUsd;
            paid = usdToCtc(claimUsd);

            uint256 remainingCap = _remainingBlockCap(subjectId);
            if (paid > remainingCap) paid = remainingCap;
            if (paid > tranches[subjectId].staked) paid = tranches[subjectId].staked;

            if (paid > 0) {
                tranches[subjectId].staked -= paid;
                tranches[subjectId].paidOut += paid;
                paidInBlock[subjectId][block.number] += paid;
                _send(payee, paid);
            }
        }

        bounty = _payBounty(subjectId, prosecutor, continuityLength);
        emit Settled(incidentId, subjectId, payee, damagesUsd, paid, prosecutor, bounty);
    }

    function _payBounty(bytes32 subjectId, address prosecutor, uint64 continuityLength) private returns (uint256 bounty) {
        if (prosecutor == address(0)) return 0;
        bounty = bountyFor(subjectId, continuityLength);
        if (bounty == 0) return 0;
        bountyPool[subjectId] -= bounty;
        _send(prosecutor, bounty);
    }

    /// @notice Bounty for evidence carrying a continuity proof of the given length, clamped to the pool.
    function bountyFor(bytes32 subjectId, uint64 continuityLength) public view returns (uint256) {
        uint256 amount = baseBounty;
        if (continuityLength > STALE_CONTINUITY) {
            amount = (amount * 20) / 100;
        } else if (continuityLength > FRESH_CONTINUITY) {
            amount = (amount * 50) / 100;
        }
        uint256 pool = bountyPool[subjectId];
        return amount > pool ? pool : amount;
    }

    function _remainingBlockCap(bytes32 subjectId) private view returns (uint256) {
        uint256 cap = REGISTRY.payoutCap(subjectId);
        uint256 used = paidInBlock[subjectId][block.number];
        return used >= cap ? 0 : cap - used;
    }

    // ----------------------------------------------------------------- bonds

    function postBond(bytes32 incidentId, address prosecutor) external payable override onlyCore {
        if (bondOf[incidentId] != 0) revert BondAlreadyPosted();
        bondOf[incidentId] = msg.value;
        bondPoster[incidentId] = prosecutor;
        emit BondPosted(incidentId, prosecutor, msg.value);
    }

    function releaseBond(bytes32 incidentId) external override onlyCore nonReentrant {
        uint256 amount = bondOf[incidentId];
        address to = bondPoster[incidentId];
        if (amount == 0 || to == address(0)) return;
        bondOf[incidentId] = 0;
        bondPoster[incidentId] = address(0);
        _send(to, amount);
        emit BondReleased(incidentId, to, amount);
    }

    function slashBond(bytes32 incidentId, address challenger) external override onlyCore nonReentrant {
        uint256 amount = bondOf[incidentId];
        if (amount == 0) return;
        bondOf[incidentId] = 0;
        bondPoster[incidentId] = address(0);
        _send(challenger, amount);
        emit BondSlashed(incidentId, challenger, amount);
    }

    function setFrozen(bytes32 subjectId, bool frozen_) external override onlyCore {
        frozen[subjectId] = frozen_;
        emit FrozenSet(subjectId, frozen_);
    }

    // ----------------------------------------------------------------- utils

    /// @notice USD (8 decimals) -> CTC wei at the configured demo rate.
    function usdToCtc(uint256 usdE8) public view returns (uint256) {
        return (usdE8 * 1 ether) / usdPerCtcE8;
    }

    function trancheOf(bytes32 subjectId) external view returns (Tranche memory) {
        return tranches[subjectId];
    }

    function _send(address to, uint256 amount) private {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    receive() external payable {}
}
