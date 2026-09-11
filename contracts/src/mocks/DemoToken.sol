// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Wrapped asset issued by DemoBridge on Ethereum Sepolia. Demo scaffolding only.
contract DemoToken is ERC20 {
    address public immutable ISSUER;

    error OnlyIssuer();

    constructor(address issuer_) ERC20("Watchtower Demo Token", "dTKN") {
        ISSUER = issuer_;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != ISSUER) revert OnlyIssuer();
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        if (msg.sender != ISSUER) revert OnlyIssuer();
        _burn(from, amount);
    }
}
