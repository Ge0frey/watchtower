import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { deploymentFromEnv, type ChainKey } from '@watchtower/shared';

loadEnv({ path: resolve(process.cwd(), '.env'), quiet: true });
loadEnv({ path: resolve(process.cwd(), '../../.env'), quiet: true });

const num = (key: string, fallback: number) => {
  const raw = process.env[key];
  return raw ? Number(raw) : fallback;
};

export const config = {
  /**
   * `PORT` first, `WORKER_PORT` second.
   *
   * Every container host - Render, Railway, Fly, Cloud Run - injects `PORT` and routes to whatever
   * the process binds there. Reading only `WORKER_PORT` means binding 8080 while the platform probes
   * the port it assigned, so the health check never passes and the service is killed as unhealthy
   * before it has done anything wrong. `WORKER_PORT` stays as the local override.
   */
  port: num('PORT', num('WORKER_PORT', 8080)),
  dataDir: process.env.WORKER_DATA_DIR ?? resolve(process.cwd(), '.data'),

  cc3Rpc: process.env.CC3_RPC ?? 'https://rpc.cc3-testnet.creditcoin.network',
  deployment: deploymentFromEnv(process.env),

  /** Scanner cadence. Ethereum blocks land every ~12s; there is nothing to gain from polling faster. */
  intraBlockPollMs: num('SCAN_INTRA_BLOCK_MS', 12_000),
  streamPollMs: num('SCAN_STREAM_MS', 20_000),
  feedPollMs: num('SCAN_FEED_MS', 120_000),

  /** How far behind the source head the scanners stay, so evidence is finalised before it is proven. */
  confirmations: num('SCAN_CONFIRMATIONS', 8),

  /**
   * Largest block range a single `eth_getLogs` may span. Alchemy's free tier hard-caps this at 10 and
   * rejects wider queries rather than throttling them, so every scan is sliced to fit.
   */
  logRange: num('LOG_RANGE', 10),

  /** How often the Creditcoin indexer polls for our own events. Blocks are ~15s. */
  indexerPollMs: num('INDEXER_POLL_MS', 10_000),

  /** Protocol batch ceiling; also the most transactions one stream submission may carry. */
  maxWindow: num('MAX_WINDOW', 10),

  /** Retry policy for the proof pipeline. */
  maxAttempts: num('MAX_ATTEMPTS', 6),
  backoffBaseMs: num('BACKOFF_BASE_MS', 15_000),

  /** Set false to run the worker as a pure indexer + API (useful when demoing read-only). */
  submitEnabled: process.env.SUBMIT_ENABLED !== 'false',

  scanners: {
    intraBlock: process.env.SCAN_INTRA_BLOCK !== 'false',
    stream: process.env.SCAN_STREAM !== 'false',
    feed: process.env.SCAN_FEED !== 'false',
  },
} as const;

export const CHAIN_KEY_SEPOLIA: ChainKey = 1;
export const CHAIN_KEY_MAINNET: ChainKey = 3;
