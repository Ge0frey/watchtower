import { mainnet, sepolia } from 'viem/chains';
import { assertSupportedChains, createClient } from '@watchtower/attestcoin';
import { config } from './config.js';
import { startApi } from './api/server.js';
import { startCreditcoinIndexer } from './indexer/creditcoin.js';
import { resumePending } from './pipeline/queue.js';
import { startFeedScanner } from './scanners/feed.js';
import { startIntraBlockScanner } from './scanners/intraBlock.js';
import { startStreamScanner } from './scanners/stream.js';
import { publicClient, prosecutorWallet } from './chain.js';
import { formatEther } from 'viem';

/**
 * The prosecutor.
 *
 * One process, three scanners, one submission path, one indexer and one API. It is completely
 * untrusted: it assembles proofs and pays gas, and the Attestcoin Smart Contract verifies everything
 * again before a single wei moves. Anyone can run one - that is the point of the bounty pool.
 */
async function main() {
  console.log('\nWATCHTOWER prosecutor\n=====================');

  const attestcoin = createClient();

  const chainId = await publicClient.getChainId();
  if (chainId !== 102031) {
    throw new Error(`connected to chainId ${chainId}, expected Creditcoin CC3 Testnet (102031)`);
  }
  console.log(`  creditcoin      chainId ${chainId}`);

  // Fail fast if the protocol's chain mapping is not what the whole design assumes.
  await assertSupportedChains(attestcoin);
  console.log('  attestcoin      chainKey 1 -> Sepolia, chainKey 3 -> Mainnet');

  if (config.submitEnabled) {
    const address = await prosecutorWallet().getAddress();
    const balance = await publicClient.getBalance({ address: address as `0x${string}` });
    console.log(`  prosecutor      ${address}  ${formatEther(balance)} CTC`);
    if (balance === 0n) console.warn('  WARNING: prosecutor has no CTC - submissions will fail');
  } else {
    console.log('  prosecutor      disabled (SUBMIT_ENABLED=false)');
  }

  const { deployment } = config;
  console.log(`  core            ${deployment.watchtowerCore}`);

  const stops: (() => void)[] = [];
  stops.push(startCreditcoinIndexer());

  if (config.scanners.intraBlock && process.env.MAINNET_RPC) {
    stops.push(
      startIntraBlockScanner(
        [process.env.MAINNET_RPC, process.env.MAINNET_RPC_FALLBACK],
        deployment.sourceContracts.pool,
        deployment.subjects.pool,
      ),
    );
    console.log(`  scanner         intra-block on ${deployment.sourceContracts.pool}`);
  }

  if (config.scanners.stream && process.env.SEPOLIA_RPC) {
    stops.push(
      startStreamScanner({
        rpcUrls: [process.env.SEPOLIA_RPC, process.env.SEPOLIA_RPC_FALLBACK],
        chain: sepolia,
        chainKey: 1,
        custodian: deployment.sourceContracts.bridge,
        subjectId: deployment.subjects.bridge,
        anchorHeight: Number(process.env.BRIDGE_ANCHOR_HEIGHT ?? 0),
      }),
    );
    console.log(`  scanner         reserve stream on ${deployment.sourceContracts.bridge}`);
  }

  if (config.scanners.feed && process.env.MAINNET_RPC) {
    stops.push(
      startFeedScanner({
        rpcUrls: [process.env.MAINNET_RPC, process.env.MAINNET_RPC_FALLBACK],
        chain: mainnet,
        chainKey: 3,
        aggregator: deployment.sourceContracts.aggregator,
        subjectId: deployment.subjects.feed,
        anchorHeight: Number(process.env.FEED_ANCHOR_HEIGHT ?? 0),
      }),
    );
    console.log(`  scanner         chainlink feed on ${deployment.sourceContracts.aggregator}`);
  }

  await startApi();
  resumePending();

  console.log('\nwatching.\n');

  const shutdown = () => {
    console.log('\nshutting down; in-flight candidates will resume on next start');
    stops.forEach((stop) => stop());
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('prosecutor failed to start:', error instanceof Error ? error.message : error);
  process.exit(1);
});
