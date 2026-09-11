// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {INativeQueryVerifier} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

import {SubjectRegistry} from "../src/core/SubjectRegistry.sol";
import {UnderwritingVault} from "../src/core/UnderwritingVault.sol";
import {WatchtowerCore} from "../src/core/WatchtowerCore.sol";
import {EvidenceInput} from "../src/interfaces/IWatchtowerCore.sol";
import {IAttestedFeed} from "../src/interfaces/IAttestedFeed.sol";
import {IUnderwritingVault} from "../src/interfaces/IUnderwritingVault.sol";
import {ChainlinkFeed} from "../src/rules/ChainlinkFeed.sol";
import {FailedTx} from "../src/rules/FailedTx.sol";
import {IntraBlockExtraction} from "../src/rules/IntraBlockExtraction.sol";
import {ReserveConservation} from "../src/rules/ReserveConservation.sol";
import {MockBlockProver} from "../src/mocks/MockBlockProver.sol";
import {SubjectKind} from "../src/types/Types.sol";
import {TxFixture} from "./TxFixture.sol";

/// @notice Shared deployment for every unit test.
/// @dev The Block Prover Precompile is native runtime code on Creditcoin, so a forked node would not
///      have it - `vm.etch` is the only way to run the core offline. The mock is stateless precisely
///      so that etching its runtime code is enough.
abstract contract Base is Test {
    address internal constant PRECOMPILE = 0x0000000000000000000000000000000000000FD2;
    uint64 internal constant MAINNET = 3;
    uint64 internal constant SEPOLIA = 1;
    uint8 internal constant DEPTH = 12; // 4096-transaction Merkle tree

    SubjectRegistry internal registry;
    UnderwritingVault internal vault;
    WatchtowerCore internal core;

    IntraBlockExtraction internal intraBlock;
    ReserveConservation internal reserve;
    ChainlinkFeed internal feed;
    FailedTx internal failedTx;

    address internal owner = makeAddr("owner");
    address internal prosecutor = makeAddr("prosecutor");
    address internal challenger = makeAddr("challenger");
    address internal underwriter = makeAddr("underwriter");
    address internal victim = makeAddr("victim");
    address internal attacker = makeAddr("attacker");
    address internal holder = makeAddr("holder");

    address internal pool = makeAddr("uniswapV2Pool");
    address internal bridge = makeAddr("demoBridge");
    address internal aggregator = makeAddr("chainlinkAggregator");

    bytes32 internal poolSubject;
    bytes32 internal bridgeSubject;
    bytes32 internal feedSubject;
    bytes32 internal accountSubject;

    function setUp() public virtual {
        vm.etch(PRECOMPILE, address(new MockBlockProver()).code);

        vm.startPrank(owner);
        registry = new SubjectRegistry(owner);
        vault = new UnderwritingVault(owner, registry);
        core = new WatchtowerCore(owner, registry, IUnderwritingVault(address(vault)), 10 minutes);
        vault.setCore(address(core));

        // Rules are deployed AFTER the core because they read prices through its IAttestedFeed
        // interface. No circularity: the core discovers rules through the registry at call time.
        IAttestedFeed feedSource = IAttestedFeed(address(core));
        intraBlock = new IntraBlockExtraction(registry, feedSource, 18, true);
        reserve = new ReserveConservation(registry, feedSource, 18);
        feed = new ChainlinkFeed(registry);
        failedTx = new FailedTx(registry, feedSource);

        registry.registerRule(intraBlock.ruleId(), address(intraBlock), true);
        registry.registerRule(reserve.ruleId(), address(reserve), true);
        registry.registerRule(feed.ruleId(), address(feed), true);
        registry.registerRule(failedTx.ruleId(), address(failedTx), true);

        poolSubject = registry.registerSubject(
            SubjectKind.POOL, MAINNET, pool, intraBlock.ruleId(), 0, 0, 100 ether, "UniV2 WETH/USDC"
        );
        bridgeSubject = registry.registerSubject(
            SubjectKind.CUSTODIAN, SEPOLIA, bridge, reserve.ruleId(), 1000, 0, 100 ether, "DemoBridge"
        );
        feedSubject = registry.registerSubject(
            SubjectKind.FEED, MAINNET, aggregator, feed.ruleId(), 2000, 0, 1 ether, "Chainlink ETH/USD"
        );
        accountSubject = registry.registerSubject(
            SubjectKind.ACCOUNT, SEPOLIA, address(0xBEEF), failedTx.ruleId(), 0, 0, 100 ether, "Failed transactions"
        );

        // Every priced subject points at the one feed subject that carries a proven dollar answer.
        registry.setPriceSubject(poolSubject, feedSubject);
        registry.setPriceSubject(bridgeSubject, feedSubject);
        registry.setPriceSubject(accountSubject, feedSubject);
        vm.stopPrank();

        // Capital, cover and bounties for every subject the tests touch.
        vm.deal(underwriter, 1000 ether);
        vm.startPrank(underwriter);
        vault.stake{value: 200 ether}(poolSubject);
        vault.stake{value: 200 ether}(bridgeSubject);
        vault.stake{value: 100 ether}(accountSubject);
        vault.fundWatch{value: 5 ether}(poolSubject);
        vault.fundWatch{value: 5 ether}(bridgeSubject);
        vault.fundWatch{value: 5 ether}(accountSubject);
        vm.stopPrank();

        vm.deal(prosecutor, 100 ether);
        vm.deal(challenger, 10 ether);
    }

    // ------------------------------------------------------------- evidence

    /// @notice Build a submission for a window of transactions at explicit coordinates.
    function evidence(
        bytes32 subjectId,
        bytes32 ruleId,
        uint64 chainKey,
        uint64[] memory heights,
        uint32[] memory indices,
        bytes[] memory encodedTxs,
        uint256 continuityLength
    ) internal pure returns (EvidenceInput memory input) {
        uint256 n = encodedTxs.length;
        bytes32[] memory roots = new bytes32[](n);
        INativeQueryVerifier.MerkleProofEntry[][] memory siblings = new INativeQueryVerifier.MerkleProofEntry[][](n);
        for (uint256 i; i < n; ++i) {
            roots[i] = keccak256(abi.encode("root", heights[i]));
            siblings[i] = TxFixture.siblingsForIndex(indices[i], DEPTH);
        }

        bytes32[] memory continuityRoots = new bytes32[](continuityLength);
        for (uint256 i; i < continuityLength; ++i) {
            continuityRoots[i] = keccak256(abi.encode("continuity", i));
        }

        input = EvidenceInput({
            subjectId: subjectId,
            ruleId: ruleId,
            chainKey: chainKey,
            blockHeights: heights,
            encodedTxs: encodedTxs,
            merkleRoots: roots,
            siblings: siblings,
            lowerEndpointDigest: keccak256("lower"),
            continuityRoots: continuityRoots
        });
    }

    /// @notice Single-transaction window at one coordinate.
    function singleEvidence(
        bytes32 subjectId,
        bytes32 ruleId,
        uint64 chainKey,
        uint64 height,
        uint32 index,
        bytes memory encodedTx,
        uint256 continuityLength
    ) internal pure returns (EvidenceInput memory) {
        uint64[] memory heights = new uint64[](1);
        heights[0] = height;
        uint32[] memory indices = new uint32[](1);
        indices[0] = index;
        bytes[] memory txs = new bytes[](1);
        txs[0] = encodedTx;
        return evidence(subjectId, ruleId, chainKey, heights, indices, txs, continuityLength);
    }

    function u64(uint64 a, uint64 b, uint64 c) internal pure returns (uint64[] memory out) {
        out = new uint64[](3);
        (out[0], out[1], out[2]) = (a, b, c);
    }

    function u32(uint32 a, uint32 b, uint32 c) internal pure returns (uint32[] memory out) {
        out = new uint32[](3);
        (out[0], out[1], out[2]) = (a, b, c);
    }

    function bytesArr(bytes memory a, bytes memory b, bytes memory c) internal pure returns (bytes[] memory out) {
        out = new bytes[](3);
        (out[0], out[1], out[2]) = (a, b, c);
    }

    /// @notice A canonical sandwich: attacker buys token0, victim buys token0, attacker sells token0.
    /// @param profit Extra token0 the attacker ends up with.
    function sandwichTxs(uint256 frontIn, uint256 victimIn, uint256 profit)
        internal
        view
        returns (bytes[] memory)
    {
        bytes memory front = TxFixture.legacy(
            attacker, pool, 0, 1, 100000, 20 gwei, TxFixture.logs1(TxFixture.swapLog(pool, frontIn, 0, 0, frontIn * 2))
        );
        bytes memory mid = TxFixture.legacy(
            victim, pool, 0, 1, 100000, 20 gwei, TxFixture.logs1(TxFixture.swapLog(pool, victimIn, 0, 0, victimIn * 2))
        );
        bytes memory back = TxFixture.legacy(
            attacker, pool, 0, 1, 100000, 20 gwei, TxFixture.logs1(TxFixture.swapLog(pool, 0, frontIn * 2, frontIn + profit, 0))
        );
        return bytesArr(front, mid, back);
    }

    /// @notice Seed a price into a subject's accumulator through the real ChainlinkFeed path.
    function seedPrice(bytes32 subjectId, uint256 priceE8, uint64 height, uint32 index) internal {
        bytes memory tx_ = TxFixture.legacy(
            makeAddr("chainlinkNode"),
            aggregator,
            0,
            1,
            80000,
            10 gwei,
            TxFixture.logs1(TxFixture.answerUpdatedLog(aggregator, int256(priceE8), 1, block.timestamp))
        );
        // Build the submission BEFORE pranking: evaluating the argument makes cheatcode calls of
        // its own, which would otherwise consume the prank and leave msg.sender as the test contract.
        EvidenceInput memory input = singleEvidence(subjectId, feed.ruleId(), MAINNET, height, index, tx_, 10);
        vm.prank(prosecutor);
        core.submitEvidence(input);
    }
}
