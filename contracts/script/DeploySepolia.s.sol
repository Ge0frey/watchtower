// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {DemoBridge} from "../src/mocks/DemoBridge.sol";

/// @notice Deploys the custodian Watchtower watches, to Ethereum SEPOLIA.
/// @dev forge script script/DeploySepolia.s.sol --rpc-url $SEPOLIA_RPC --broadcast
contract DeploySepolia is Script {
    function run() external {
        uint256 pk = vm.envUint("SEPOLIA_DEMO_PK");
        vm.startBroadcast(pk);

        DemoBridge bridge = new DemoBridge();
        bridge.lock{value: 0.01 ether}(); // anchor the reserve ledger with real collateral

        vm.stopBroadcast();

        console2.log("DEMO_BRIDGE_SEPOLIA=%s", address(bridge));
        console2.log("DEMO_TOKEN_SEPOLIA=%s", address(bridge.token()));
        console2.log("BRIDGE_ANCHOR_HEIGHT=%s", vm.toString(block.number));
    }
}
