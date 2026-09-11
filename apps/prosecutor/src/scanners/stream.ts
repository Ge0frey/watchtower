import { createPublicClient, type Address, type Chain, type Hex } from 'viem';
import { RULES, topicHash, TOPICS, type ChainKey } from '@watchtower/shared';
import { bus } from '../bus.js';
import { config } from '../config.js';
import { store } from '../db/store.js';
import { queue } from '../pipeline/queue.js';
import { getLogsChunked } from '../rpc.js';
import { rpcTransport } from '../transport.js';
import { hasWorkInFlight, isAfter, provenCursor } from './cursor.js';

const CUSTODIAN_TOPICS = [
  topicHash(TOPICS.locked),
  topicHash(TOPICS.unlocked),
  topicHash(TOPICS.minted),
  topicHash(TOPICS.burned),
] as Hex[];

/**
 * Reserve-stream ingestion for a custodian.
 *
 * Order and completeness are the whole game here, so the scanner keeps no cursor of its own: every
 * tick asks Creditcoin where the subject has actually been proven up to and works forward from
 * there. Progress is therefore only ever recorded by a confirmed on-chain receipt - a submission that
 * fails is simply rebuilt next tick from the same coordinate.
 *
 * The alternative, advancing a local watermark at submission time, is precisely the bug this system
 * exists to punish: any transaction the worker moved past without proving becomes a permanent hole in
 * the ledger, and anyone can turn that hole into a gap challenge against the worker's own bond.
 *
 * `lastScanned` survives only as a *nothing-here* watermark: it advances when a range has been read
 * and contained no relevant events, which is a fact a later submission cannot invalidate.
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
      if (hasWorkInFlight(opts.subjectId)) return;

      const cursor = await provenCursor(opts.subjectId);
      const head = Number(await client.getBlockNumber());
      const safeHead = head - config.confirmations;

      // Start at the proven block itself, not after it: the cursor is a (block, index) pair, and
      // there may be further custodian transactions later in that same block.
      const watermark = store.lastScanned(key) ?? opts.anchorHeight;
      const from = Math.max(cursor.height, watermark, opts.anchorHeight);
      if (safeHead < from) return;

      const to = Math.min(safeHead, from + 500);
      const logs = await getLogsChunked(
        client,
        { address: opts.custodian, fromBlock: BigInt(from), toBlock: BigInt(to) },
        config.logRange,
      );

      const relevant = logs
        .filter((l) => l.topics[0] && CUSTODIAN_TOPICS.includes(l.topics[0].toLowerCase() as Hex))
        .filter((l) => isAfter(cursor, Number(l.blockNumber), l.transactionIndex))
        .sort((a, b) =>
          Number(a.blockNumber - b.blockNumber) || a.transactionIndex - b.transactionIndex,
        );

      if (relevant.length === 0) {
        // Nothing to prove in this range - a fact no later submission can invalidate, so the
        // watermark may safely move. Stay one block behind `to` only if `to` is the cursor block
        // itself, which cannot happen here because the range was empty.
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

      const candidate = {
        id: `reserve-${opts.subjectId.slice(2, 10)}-${cursor.height}.${cursor.index}-${uniqueTxs.length}`,
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
      console.log(
        `[stream] ${uniqueTxs.length} custodian tx(s) after ${cursor.height}.${cursor.index}, up to block ${windowEnd}`,
      );

      // A reserve breach opens a bonded optimistic claim, so the submission carries the bond. If the
      // window turns out to be an ordinary advance, the core refunds it in the same transaction.
      //
      // Nothing is written down as progress here. The next tick re-reads the on-chain cursor: if this
      // submission confirmed, these transactions fall behind it and drop out of the filter; if it did
      // not, the identical window is rebuilt and tried again.
      queue.enqueue(candidate, bondWei());
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
