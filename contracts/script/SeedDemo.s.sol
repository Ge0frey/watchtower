// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {UnderwritingVault} from "../src/core/UnderwritingVault.sol";

/// @notice Stakes capital, buys cover and funds bounties so the dashboard opens alive.
///
/// @dev Every amount scales with `SEED_SCALE_BPS` (10000 = the full 8.3 CTC budget below), because
///      how much the testnet faucet hands out per request is not something this repository controls.
///      Halve it with `SEED_SCALE_BPS=5000` and the demo still works - the dashboard shows smaller
///      numbers, nothing else changes.
///
///      Run at T-60 minutes: forge script script/SeedDemo.s.sol --rpc-url $CC3_RPC --broadcast
contract SeedDemo is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address deployer = vm.addr(pk);
        UnderwritingVault vault = UnderwritingVault(payable(vm.envAddress("UNDERWRITING_VAULT")));

        bytes32 poolSubject = vm.envBytes32("SUBJECT_POOL");
        bytes32 bridgeSubject = vm.envBytes32("SUBJECT_BRIDGE");
        bytes32 accountSubject = vm.envBytes32("SUBJECT_ACCOUNT");

        uint256 scale = vm.envOr("SEED_SCALE_BPS", uint256(10_000));

        uint256 stakePool = _scaled(3 ether, scale);
        uint256 stakeBridge = _scaled(3 ether, scale);
        uint256 stakeAccount = _scaled(1 ether, scale);
        uint256 bountyPool = _scaled(0.5 ether, scale);
        uint256 bountyBridge = _scaled(0.5 ether, scale);
        uint256 bountyAccount = _scaled(0.25 ether, scale);
        uint256 coverPool = _scaled(0.02 ether, scale);
        uint256 coverBridge = _scaled(0.02 ether, scale);
        uint256 coverAccount = _scaled(0.01 ether, scale);

        uint256 total = stakePool + stakeBridge + stakeAccount + bountyPool + bountyBridge
            + bountyAccount + coverPool + coverBridge + coverAccount;

        console2.log("seeding %s wei from %s", total, deployer);
        require(
            deployer.balance > total,
            "deployer balance below seed budget - top up, or lower SEED_SCALE_BPS"
        );

        vm.startBroadcast(pk);

        vault.stake{value: stakePool}(poolSubject);
        vault.stake{value: stakeBridge}(bridgeSubject);
        vault.stake{value: stakeAccount}(accountSubject);

        vault.fundWatch{value: bountyPool}(poolSubject);
        vault.fundWatch{value: bountyBridge}(bridgeSubject);
        vault.fundWatch{value: bountyAccount}(accountSubject);

        // Cover is denominated in USD (8 decimals); the premium is 1% of cover per 30 days.
        vault.buyCover{value: coverPool}(poolSubject, 2e8, 30 days);
        vault.buyCover{value: coverBridge}(bridgeSubject, 2e8, 30 days);
        vault.buyCover{value: coverAccount}(accountSubject, 1e8, 30 days);

        vm.stopBroadcast();

        console2.log("staked      %s wei", stakePool + stakeBridge + stakeAccount);
        console2.log("bounties    %s wei", bountyPool + bountyBridge + bountyAccount);
        console2.log("premiums    %s wei", coverPool + coverBridge + coverAccount);
    }

    function _scaled(uint256 amount, uint256 scaleBps) private pure returns (uint256) {
        return (amount * scaleBps) / 10_000;
    }
}
