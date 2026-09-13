/**
 * Sandwich detection, shared by the scanner and the stager.
 *
 * Lifted verbatim out of `find-sandwich.mjs` so that `stage-sandwich.mjs` judges a window by exactly
 * the same rules the exploratory scanner does. Two implementations of "is this a sandwich" would
 * eventually disagree, and the one that disagreed silently would be the one staging a demo.
 *
 * The heuristic here is deliberately loose, the same way the worker's scanner is: the contract is the
 * arbiter. What this must never do is *miss* the shape the rule can judge, or invent one it cannot.
 */
import { Contract, Interface, id } from 'ethers';

export const SWAP_TOPIC = id('Swap(address,uint256,uint256,uint256,uint256,address)');

const iface = new Interface([
  'event Swap(address indexed sender,uint256 amount0In,uint256 amount1In,uint256 amount0Out,uint256 amount1Out,address indexed to)',
]);
const PAIR_ABI = ['function token0() view returns (address)', 'function token1() view returns (address)'];
const ERC20_ABI = ['function symbol() view returns (string)', 'function decimals() view returns (uint8)'];

const tokenCache = new Map();

/** token0/token1 symbols and decimals for a pair, cached for the life of the process. */
export async function describePair(provider, pool) {
  if (tokenCache.has(pool)) return tokenCache.get(pool);
  try {
    const pair = new Contract(pool, PAIR_ABI, provider);
    const [t0, t1] = [await pair.token0(), await pair.token1()];
    const meta = async (t) => {
      const c = new Contract(t, ERC20_ABI, provider);
      try {
        return { address: t, symbol: await c.symbol(), decimals: Number(await c.decimals()) };
      } catch {
        return { address: t, symbol: '?', decimals: 18 };
      }
    };
    const info = { token0: await meta(t0), token1: await meta(t1) };
    tokenCache.set(pool, info);
    return info;
  } catch {
    tokenCache.set(pool, null);
    return null;
  }
}

/**
 * Yield every sandwich in `from..to`, in block order, stopping after `limit`.
 *
 * `onSliceError` is called rather than logged, so each caller decides whether a failed `eth_getLogs`
 * slice is worth printing. Ranges are chunked to `logRange` because Alchemy's free tier rejects a
 * wider `eth_getLogs` outright rather than throttling it.
 */
export async function* scanSandwiches({ provider, from, to, pool = null, limit = 5, logRange = 10, onSliceError }) {
  let found = 0;

  for (let start = from; start <= to && found < limit; start += logRange) {
    const end = Math.min(to, start + logRange - 1);
    let logs = [];
    try {
      logs = await provider.getLogs({ ...(pool ? { address: pool } : {}), topics: [SWAP_TOPIC], fromBlock: start, toBlock: end });
    } catch (e) {
      onSliceError?.(start, end, e);
      continue;
    }

    const byBlock = new Map();
    for (const log of logs) {
      if (!byBlock.has(log.blockNumber)) byBlock.set(log.blockNumber, []);
      byBlock.get(log.blockNumber).push(log);
    }

    for (const [height, blockLogs] of [...byBlock.entries()].sort((a, b) => a[0] - b[0])) {
      const byPool = new Map();
      for (const log of blockLogs) {
        const key = log.address.toLowerCase();
        if (!byPool.has(key)) byPool.set(key, []);
        byPool.get(key).push(log);
      }
      // Three swaps on one pool in one block is the cheapest possible filter before paying for a
      // full block fetch, which is the expensive call here.
      const busy = [...byPool.entries()].filter(([, ls]) => ls.length >= 3);
      if (busy.length === 0) continue;

      const block = await provider.getBlock(height, true);
      const senderOf = new Map();
      for (const hash of block.transactions) {
        const tx = block.getPrefetchedTransaction(hash);
        senderOf.set(tx.hash.toLowerCase(), tx.from.toLowerCase());
      }

      for (const [poolAddress, poolLogs] of busy) {
        const rows = poolLogs
          .map((log) => {
            const a = iface.decodeEventLog('Swap', log.data, log.topics);
            return {
              hash: log.transactionHash,
              idx: log.transactionIndex,
              from: senderOf.get(log.transactionHash.toLowerCase()) ?? '',
              a0In: a[1], a1In: a[2], a0Out: a[3], a1Out: a[4],
            };
          })
          .sort((x, y) => x.idx - y.idx);

        for (let i = 0; i + 2 < rows.length && found < limit; i++) {
          const [front, victim, back] = [rows[i], rows[i + 1], rows[i + 2]];
          if (victim.idx !== front.idx + 1 || back.idx !== victim.idx + 1) continue;
          if (!front.from || front.from !== back.from || victim.from === front.from) continue;

          const side0 = front.a0In > 0n;
          const profitable = side0
            ? victim.a0In > 0n && back.a0Out > front.a0In
            : front.a1In > 0n && victim.a1In > 0n && back.a1Out > front.a1In;
          if (!profitable) continue;

          const profit = side0 ? back.a0Out - front.a0In : back.a1Out - front.a1In;
          const pair = await describePair(provider, poolAddress);
          const spent = pair ? (side0 ? pair.token0 : pair.token1) : null;
          const priceable = spent ? spent.decimals === 18 : false;

          found++;
          yield { height, pool: poolAddress, pair, front, victim, back, side0, profit, spent, priceable };
        }
      }
    }
  }
}
