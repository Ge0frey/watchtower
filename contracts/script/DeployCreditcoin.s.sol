// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {SubjectRegistry} from "../src/core/SubjectRegistry.sol";
import {UnderwritingVault} from "../src/core/UnderwritingVault.sol";
import {WatchtowerCore} from "../src/core/WatchtowerCore.sol";
import {IAttestedFeed} from "../src/interfaces/IAttestedFeed.sol";
import {IUnderwritingVault} from "../src/interfaces/IUnderwritingVault.sol";
import {ChainlinkFeed} from "../src/rules/ChainlinkFeed.sol";
import {FailedTx} from "../src/rules/FailedTx.sol";
import {IntraBlockExtraction} from "../src/rules/IntraBlockExtraction.sol";
import {ReserveConservation} from "../src/rules/ReserveConservation.sol";
import {SubjectKind} from "../src/types/Types.sol";

/// @notice Deploys Watchtower to Creditcoin CC3 Testnet (chain id 102031) and registers the demo
///         subjects.
///
/// @dev Deployment order matters: rules read prices through the core's `IAttestedFeed` interface, so
///      the core is deployed first and the rules point at it. There is no circularity - the core
///      discovers rules through the registry at call time, never at construction.
///
///      No library linking is required. `EvmV1Decoder` exposes only `internal` functions and inlines
///      into its callers, so the deployed decoder at 0x731c... is irrelevant to us.
///
///      forge script script/DeployCreditcoin.s.sol --rpc-url $CC3_RPC --broadcast
contract DeployCreditcoin is Script {
    uint64 internal constant CHAIN_KEY_SEPOLIA = 1;
    uint64 internal constant CHAIN_KEY_MAINNET = 3;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PK");
        address deployer = vm.addr(pk);

        address pool = vm.envAddress("DEMO_POOL_MAINNET");
        address aggregator = vm.envAddress("DEMO_AGGREGATOR_MAINNET");
        address bridge = vm.envAddress("DEMO_BRIDGE_SEPOLIA");
        address failedTxWatch = vm.envAddress("DEMO_FAILED_TX_WATCH");

        vm.startBroadcast(pk);

        SubjectRegistry registry = new SubjectRegistry(deployer);
        UnderwritingVault vault = new UnderwritingVault(deployer, registry);
        WatchtowerCore core =
            new WatchtowerCore(deployer, registry, IUnderwritingVault(address(vault)), 10 minutes);
        vault.setCore(address(core));

        IAttestedFeed feedSource = IAttestedFeed(address(core));
        // 18 decimals, priced side is token1: on the canonical USDC/WETH pair token0 is USDC (6dp)
        // and token1 is WETH, and the linked feed is ETH/USD.
        IntraBlockExtraction intraBlock = new IntraBlockExtraction(registry, feedSource, 18, false);
        ReserveConservation reserve = new ReserveConservation(registry, feedSource, 18);
        ChainlinkFeed feed = new ChainlinkFeed(registry);
        FailedTx failedTx = new FailedTx(registry, feedSource);

        registry.registerRule(intraBlock.ruleId(), address(intraBlock), true);
        registry.registerRule(reserve.ruleId(), address(reserve), true);
        registry.registerRule(feed.ruleId(), address(feed), true);
        registry.registerRule(failedTx.ruleId(), address(failedTx), true);

        // The price subject has to exist first: every other subject denominates its damages with it.
        bytes32 feedSubject = registry.registerSubject(
            SubjectKind.FEED,
            CHAIN_KEY_MAINNET,
            aggregator,
            feed.ruleId(),
            uint64(vm.envUint("FEED_ANCHOR_HEIGHT")),
            0,
            1 ether,
            "Chainlink ETH/USD"
        );
        bytes32 poolSubject = registry.registerSubject(
            SubjectKind.POOL, CHAIN_KEY_MAINNET, pool, intraBlock.ruleId(), 0, 0, 100 ether, "UniV2 WETH/USDC"
        );
        bytes32 bridgeSubject = registry.registerSubject(
            SubjectKind.CUSTODIAN,
            CHAIN_KEY_SEPOLIA,
            bridge,
            reserve.ruleId(),
            uint64(vm.envUint("BRIDGE_ANCHOR_HEIGHT")),
            0,
            100 ether,
            "DemoBridge (Sepolia)"
        );
        bytes32 accountSubject = registry.registerSubject(
            SubjectKind.ACCOUNT, CHAIN_KEY_SEPOLIA, failedTxWatch, failedTx.ruleId(), 0, 0, 50 ether, "Failed transactions"
        );

        registry.setPriceSubject(poolSubject, feedSubject);
        registry.setPriceSubject(bridgeSubject, feedSubject);
        registry.setPriceSubject(accountSubject, feedSubject);

        vm.stopBroadcast();

        console2.log("SUBJECT_REGISTRY=%s", address(registry));
        console2.log("UNDERWRITING_VAULT=%s", address(vault));
        console2.log("WATCHTOWER_CORE=%s", address(core));
        console2.log("RULE_INTRABLOCK=%s", address(intraBlock));
        console2.log("RULE_RESERVE=%s", address(reserve));
        console2.log("RULE_FEED=%s", address(feed));
        console2.log("RULE_FAILEDTX=%s", address(failedTx));
        console2.log("SUBJECT_FEED=%s", vm.toString(feedSubject));
        console2.log("SUBJECT_POOL=%s", vm.toString(poolSubject));
        console2.log("SUBJECT_BRIDGE=%s", vm.toString(bridgeSubject));
        console2.log("SUBJECT_ACCOUNT=%s", vm.toString(accountSubject));
    }
}
