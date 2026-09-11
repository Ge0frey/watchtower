import { createPublicClient, type Address, type Chain, type Hex } from 'viem';
import { RULES, topicHash, TOPICS, type ChainKey } from '@watchtower/shared';
import { bus } from '../bus.js';
import { config } from '../config.js';
import { store } from '../db/store.js';
import { queue } from '../pipeline/queue.js';
import { getLogsChunked } from '../rpc.js';
import { rpcTransport } from '../transport.js';

const CUSTODIAN_TOPICS = [
  topicHash(TOPICS.locked),
  topicHash(TOPICS.unlocked),
  topicHash(TOPICS.minted),
  topicHash(TOPICS.burned),
] as Hex[];

/**
 * Reserve-stream ingestion for a custodian.
 *
 * Order and completeness are the whole game here. The contract refuses anything that does not
 * strictly advance the cursor, so this scanner submits ascending, never skips, and only records
 * progress once an on-chain receipt confirms. If the source RPC returns a partial range, the range is
 * re-requested rather than stepped over - a gap silently swallowed here is exactly what the
 * challenge mechanism exists to punish.
 */
export function startStreamScanner(opts: {
  rpcUrls: (string | undefined)[];
  chain: Chain;
  chainKey: ChainKey;
  custodian: Address;
  subjectId: Hex;
  anchorHeight: number;
}) {
  const client = createPublicClient({ chain: opts.chain, transport: rpcTransport(opts.rpcUrls) });
  const key = `stream:${opts.subjectId}`;

  async function tick() {
    try {
      const head = Number(await client.getBlockNumber());
      const safeHead = head - config.confirmations;
      const from = store.lastScanned(key) ?? opts.anchorHeight;
      if (safeHead <= from) return;

      const to = Math.min(safeHead, from + 500);
      const logs = await getLogsChunked(
        client,
        { address: opts.custodian, fromBlock: BigInt(from + 1), toBlock: BigInt(to) },
        config.logRange,
      );

      const relevant = logs
        .filter((l) => l.topics[0] && CUSTODIAN_TOPICS.includes(l.topics[0].toLowerCase() as Hex))
        .sort((a, b) =>
          Number(a.blockNumber - b.blockNumber) || a.transactionIndex - b.transactionIndex,
        );

      if (relevant.length === 0) {
        store.setLastScanned(key, to);
        return;
      }

      // One transaction may carry several events; the window is a set of transactions, deduped and
      // capped at the protocol's batch ceiling of ten sharing one continuity proof.
      const uniqueTxs: Hex[] = [];
      let windowEnd = 0;
      for (const log of relevant) {
        if (!uniqueTxs.includes(log.transactionHash)) {
          if (uniqueTxs.length === config.maxWindow) break;
          uniqueTxs.push(log.transactionHash);
          windowEnd = Number(log.blockNumber);
        }
      }
      if (uniqueTxs.length === 0) return;
      if (store.hasCandidateFor(uniqueTxs)) return;

      const candidate = {
        id: `reserve-${opts.subjectId.slice(2, 10)}-${windowEnd}-${uniqueTxs.length}`,
        subjectId: opts.subjectId,
        ruleId: RULES.reserveConservation.id,
        chainKey: opts.chainKey,
        txHashes: uniqueTxs,
        blockHeight: windowEnd,
        state: 'DETECTED' as const,
        attempts: 0,
        createdAt: new Date().toISOString(),
      };

      store.upsertCandidate(candidate);
      bus.publish({ type: 'candidate.found', candidate });
      console.log(`[stream] ${uniqueTxs.length} custodian tx(s) up to block ${windowEnd}`);

      // A reserve breach opens a bonded optimistic claim, so the submission carries the bond. If the
      // window turns out to be an ordinary advance, the core refunds it in the same transaction.
      queue.enqueue(candidate, bondWei());
      store.setLastScanned(key, windowEnd);
    } catch (error) {
      console.warn('[stream] scan failed:', error instanceof Error ? error.message : error);
    }
  }

  const timer = setInterval(tick, config.streamPollMs);
  void tick();
  return () => clearInterval(timer);
}

function bondWei(): bigint {
  return BigInt(process.env.PROSECUTOR_BOND_WEI ?? '100000000000000000'); // 0.1 CTC
}
