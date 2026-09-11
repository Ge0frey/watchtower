import { createPublicClient, type Address, type Chain, type Hex } from 'viem';
import { RULES, topicHash, TOPICS, type ChainKey } from '@watchtower/shared';
import { bus } from '../bus.js';
import { config } from '../config.js';
import { store } from '../db/store.js';
import { queue } from '../pipeline/queue.js';
import { getLogsChunked } from '../rpc.js';
import { rpcTransport } from '../transport.js';
import { hasWorkInFlight, isAfter, provenCursor } from './cursor.js';

const ANSWER_UPDATED = topicHash(TOPICS.answerUpdated) as Hex;

/**
 * Price ingestion: Chainlink's own `AnswerUpdated` transactions, proven rather than reported.
 *
 * Every round is not worth proving - each ingestion costs gas, and the accumulator only needs a
 * recent answer - so this samples the latest round it can see per tick.
 *
 * The address watched must be the AGGREGATOR, not the consumer-facing proxy: `AnswerUpdated` is
 * emitted by the aggregator.
 *
 * Like the reserve stream, the feed is a `SEQUENTIAL_STREAM` rule, so the chain's own cursor decides
 * what counts as new. Sampling a round the accumulator has already passed would simply revert with
 * `CursorRegression` and burn the gas finding out.
 */
export function startFeedScanner(opts: {
  rpcUrls: (string | undefined)[];
  chain: Chain;
  chainKey: ChainKey;
  aggregator: Address;
  subjectId: Hex;
  anchorHeight: number;
}) {
  const client = createPublicClient({ chain: opts.chain, transport: rpcTransport(opts.rpcUrls) });
  const key = `feed:${opts.subjectId}`;

  async function tick() {
    try {
      if (hasWorkInFlight(opts.subjectId)) return;

      const cursor = await provenCursor(opts.subjectId);
      const head = Number(await client.getBlockNumber());
      const safeHead = head - config.confirmations;
      const watermark = store.lastScanned(key) ?? Math.max(opts.anchorHeight, safeHead - 2000);
      const from = Math.max(cursor.height, watermark, opts.anchorHeight);
      if (safeHead < from) return;

      const to = Math.min(safeHead, from + 2000);
      const logs = await getLogsChunked(
        client,
        { address: opts.aggregator, fromBlock: BigInt(from), toBlock: BigInt(to) },
        config.logRange,
      );

      const rounds = logs
        .filter((l) => l.topics[0]?.toLowerCase() === ANSWER_UPDATED.toLowerCase())
        .filter((l) => isAfter(cursor, Number(l.blockNumber), l.transactionIndex))
        .sort((a, b) => Number(a.blockNumber - b.blockNumber) || a.transactionIndex - b.transactionIndex);

      const latest = rounds.at(-1);
      if (!latest) {
        store.setLastScanned(key, to);
        return;
      }

      const candidate = {
        id: `price-${Number(latest.blockNumber)}-${latest.transactionIndex}`,
        subjectId: opts.subjectId,
        ruleId: RULES.chainlinkFeed.id,
        chainKey: opts.chainKey,
        txHashes: [latest.transactionHash],
        blockHeight: Number(latest.blockNumber),
        state: 'DETECTED' as const,
        attempts: 0,
        createdAt: new Date().toISOString(),
      };

      store.upsertCandidate(candidate);
      bus.publish({ type: 'candidate.found', candidate });
      queue.enqueue(candidate);
      // No local progress is recorded: the on-chain cursor advances when the round is proven, and
      // that is what the next tick filters against.
    } catch (error) {
      console.warn('[feed] scan failed:', error instanceof Error ? error.message : error);
    }
  }

  const timer = setInterval(tick, config.feedPollMs);
  void tick();
  return () => clearInterval(timer);
}
