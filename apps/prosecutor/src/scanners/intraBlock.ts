import { createPublicClient, parseAbiItem, type Address, type Hex } from 'viem';
import { mainnet } from 'viem/chains';
import { RULES, topicHash, TOPICS, type ChainKey } from '@watchtower/shared';
import { bus } from '../bus.js';
import { config, CHAIN_KEY_MAINNET } from '../config.js';
import { store } from '../db/store.js';
import { queue } from '../pipeline/queue.js';
import { rpcTransport } from '../transport.js';

const SWAP = parseAbiItem(
  'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)',
);
const SWAP_TOPIC = topicHash(TOPICS.swapV2);

interface SwapRow {
  txHash: Hex;
  txIndex: number;
  from: Address;
  amount0In: bigint;
  amount1In: bigint;
  amount0Out: bigint;
  amount1Out: bigint;
}

/**
 * Sandwich detection on Ethereum Mainnet.
 *
 * The heuristic is deliberately loose - a candidate costs only a read-only pre-flight, and the
 * contract is the arbiter. What it looks for is the shape no Ethereum contract can see for itself:
 * three consecutive positions in one block, the outer two sent by the same address, all three
 * touching the same pool, with the attacker's round trip landing in profit.
 */
export function startIntraBlockScanner(rpcUrls: (string | undefined)[], pool: Address, subjectId: Hex) {
  const client = createPublicClient({ chain: mainnet, transport: rpcTransport(rpcUrls) });
  const key = `intraBlock:${pool.toLowerCase()}`;

  async function tick() {
    try {
      const head = Number(await client.getBlockNumber());
      const safeHead = head - config.confirmations;
      const from = store.lastScanned(key) ?? safeHead - 1;
      if (safeHead <= from) return;

      // One block at a time keeps the log query small and the candidate set precise.
      for (let height = from + 1; height <= Math.min(safeHead, from + 5); height++) {
        await scanBlock(height);
        store.setLastScanned(key, height);
      }
    } catch (error) {
      console.warn('[intraBlock] scan failed:', error instanceof Error ? error.message : error);
    }
  }

  async function scanBlock(height: number) {
    const logs = await client.getLogs({
      address: pool,
      event: SWAP,
      fromBlock: BigInt(height),
      toBlock: BigInt(height),
    });
    if (logs.length < 3) return;

    const block = await client.getBlock({ blockNumber: BigInt(height), includeTransactions: true });
    const senderOf = new Map<string, Address>();
    for (const tx of block.transactions) {
      if (typeof tx !== 'string') senderOf.set(tx.hash.toLowerCase(), tx.from);
    }

    const rows: SwapRow[] = logs
      .filter((l) => l.topics[0]?.toLowerCase() === SWAP_TOPIC.toLowerCase())
      .map((l) => ({
        txHash: l.transactionHash,
        txIndex: l.transactionIndex,
        from: senderOf.get(l.transactionHash.toLowerCase()) ?? ('0x' as Address),
        amount0In: l.args.amount0In ?? 0n,
        amount1In: l.args.amount1In ?? 0n,
        amount0Out: l.args.amount0Out ?? 0n,
        amount1Out: l.args.amount1Out ?? 0n,
      }))
      .sort((a, b) => a.txIndex - b.txIndex);

    for (let i = 0; i + 2 < rows.length; i++) {
      const [front, victim, back] = [rows[i]!, rows[i + 1]!, rows[i + 2]!];
      if (!isSandwich(front, victim, back)) continue;

      const txHashes = [front.txHash, victim.txHash, back.txHash];
      if (store.hasCandidateFor(txHashes)) continue;

      const candidate = {
        id: `sandwich-${height}-${front.txIndex}`,
        subjectId,
        ruleId: RULES.intraBlockExtraction.id,
        chainKey: CHAIN_KEY_MAINNET as ChainKey,
        txHashes,
        blockHeight: height,
        state: 'DETECTED' as const,
        attempts: 0,
        createdAt: new Date().toISOString(),
      };

      store.upsertCandidate(candidate);
      bus.publish({ type: 'candidate.found', candidate });
      console.log(`[intraBlock] candidate at block ${height}, indices ${front.txIndex}-${back.txIndex}`);
      queue.enqueue(candidate);
    }
  }

  const timer = setInterval(tick, config.intraBlockPollMs);
  void tick();
  return () => clearInterval(timer);
}

/** Positions must be consecutive, the brackets must share a sender, and the round trip must gain. */
function isSandwich(front: SwapRow, victim: SwapRow, back: SwapRow): boolean {
  if (victim.txIndex !== front.txIndex + 1 || back.txIndex !== victim.txIndex + 1) return false;
  if (front.from === '0x' || front.from.toLowerCase() !== back.from.toLowerCase()) return false;
  if (victim.from.toLowerCase() === front.from.toLowerCase()) return false;

  if (front.amount0In > 0n) {
    return victim.amount0In > 0n && back.amount0Out > front.amount0In;
  }
  if (front.amount1In > 0n) {
    return victim.amount1In > 0n && back.amount1Out > front.amount1In;
  }
  return false;
}
