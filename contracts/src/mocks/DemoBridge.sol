// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DemoToken} from "./DemoToken.sol";

/// @title DemoBridge
/// @notice The custodian Watchtower watches during the demo. Deployed to Ethereum SEPOLIA.
///
/// @dev Source-chain logic is kept deliberately minimal and the events deliberately unambiguous -
///      exactly the practice the Attestcoin documentation recommends for contracts that feed
///      readability queries. Each event carries everything the Creditcoin-side rule needs, and no
///      standard `Transfer` is ever used as a cross-chain trigger.
///
///      `mintUnbacked` is the staged incident: it mints liabilities without locking collateral, which
///      is precisely the invariant ReserveConservation proves on Creditcoin.
contract DemoBridge {
    DemoToken public token;
    address public immutable OPERATOR;

    uint256 public totalLocked;
    uint256 public totalMinted;

    event Locked(address indexed from, uint256 amount);
    event Unlocked(address indexed to, uint256 amount);
    event Minted(address indexed to, uint256 amount);
    event Burned(address indexed from, uint256 amount);

    error OnlyOperator();
    error NothingToUnlock();

    modifier onlyOperator() {
        if (msg.sender != OPERATOR) revert OnlyOperator();
        _;
    }

    constructor() {
        OPERATOR = msg.sender;
        token = new DemoToken(address(this));
    }

    /// @notice Lock collateral. Emits the event the reserve accumulator counts as an asset.
    function lock() external payable {
        totalLocked += msg.value;
        emit Locked(msg.sender, msg.value);
    }

    /// @notice Mint wrapped liabilities against locked collateral - the honest path.
    function mint(address to, uint256 amount) external onlyOperator {
        totalMinted += amount;
        token.mint(to, amount);
        emit Minted(to, amount);
    }

    /// @notice Mint liabilities with no collateral behind them. The staged insolvency.
    /// @dev Identical event to `mint`, because a real custodian's over-issuance looks identical from
    ///      the outside too. Only the running totals betray it - which is the point of the rule.
    function mintUnbacked(address to, uint256 amount) external onlyOperator {
        totalMinted += amount;
        token.mint(to, amount);
        emit Minted(to, amount);
    }

    function burn(uint256 amount) external {
        token.burn(msg.sender, amount);
        totalMinted -= amount;
        emit Burned(msg.sender, amount);
    }

    function unlock(address payable to, uint256 amount) external onlyOperator {
        if (amount > address(this).balance) revert NothingToUnlock();
        totalLocked -= amount;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "unlock failed");
        emit Unlocked(to, amount);
    }

    /// @notice Always reverts. Used to stage the FailedTx demo beat.
    function alwaysReverts() external pure {
        revert("DemoBridge: staged failure");
    }
}
