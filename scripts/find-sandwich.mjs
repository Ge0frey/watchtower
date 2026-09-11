/**
 * Find a real sandwich on Ethereum Mainnet, right now.
 *
 * The demo's headline beat needs a genuine mainnet sandwich, and which pools are being sandwiched
 * changes week to week — the canonical UniV2 USDC/WETH pair, for instance, goes thousands of blocks
 * without one because that flow moved to V3. So this does not guess: it scans recent blocks for the
 * shape `IntraBlockExtraction` judges and prints the transaction triples.
 *
 *   node scripts/find-sandwich.mjs                       # every UniV2-style pool, last 150 blocks
 *   node scripts/find-sandwich.mjs --pool 0xB4e1… --span 400
 *   node scripts/find-sandwich.mjs --from 21340000 --span 200
 *
 * The heuristic is the scanner's, deliberately loose — the contract is the arbiter. What it will not
 * report is a window the deployed rule cannot price: `IntraBlockExtraction` is configured for one
 * side of the pair (see its `PRICED_SIDE_IS_TOKEN0`), so a sandwich run on the other side is real but
 * unquotable by that instance, and is flagged rather than offered.
 *
 * Then: `node scripts/watch-address.mjs <pool> --label "…"` to register it, and prosecute the triple.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Contract, Interface, JsonRpcProvider, id } from 'ethers';

const ROOT = process.cwd();
const env = Object.fromEntries(
  readFileSync(resolve(ROOT, '.env'), 'utf8').split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '')];
    }),
);

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

const POOL = flag('pool', null);
const SPAN = Number(flag('span', '150'));
const LIMIT = Number(flag('limit', '5'));

const SWAP = id('Swap(address,uint256,uint256,uint256,uint256,address)');
const iface = new Interface([
  'event Swap(address indexed sender,uint256 amount0In,uint256 amount1In,uint256 amount0Out,uint256 amount1Out,address indexed to)',
]);
const PAIR_ABI = ['function token0() view returns (address)', 'function token1() view returns (address)'];
const ERC20_ABI = ['function symbol() view returns (string)', 'function decimals() view returns (uint8)'];

const provider = new JsonRpcProvider(env.MAINNET_RPC);

/** Alchemy's free tier hard-caps a single `eth_getLogs` at a 10-block range. */
const LOG_RANGE = Number(env.LOG_RANGE ?? 10);

const tokenCache = new Map();
async function describePair(pool) {
  if (tokenCache.has(pool)) return tokenCache.get(pool);
  try {
    const pair = new Contract(pool, PAIR_ABI, provider);
    const [t0, t1] = [await pair.token0(), await pair.token1()];
    const meta = async (t) => {
      const c = new Contract(t, ERC20_ABI, provider);
      try {
        return { symbol: await c.symbol(), decimals: Number(await c.decimals()) };
      } catch {
        return { symbol: '?', decimals: 18 };
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

async function main() {
  const head = await provider.getBlockNumber();
  const safeHead = head - 8;
  const from = Number(flag('from', String(safeHead - SPAN)));
  console.log(`\nscanning ${POOL ?? 'every UniV2-style pool'}, blocks ${from}..${safeHead}\n`);

  let found = 0;
  for (let start = from; start <= safeHead && found < LIMIT; start += LOG_RANGE) {
    const end = Math.min(safeHead, start + LOG_RANGE - 1);
    let logs = [];
    try {
      logs = await provider.getLogs({ ...(POOL ? { address: POOL } : {}), topics: [SWAP], fromBlock: start, toBlock: end });
    } catch (e) {
      console.error(`  slice ${start}-${end} failed: ${(e.shortMessage ?? e.message).slice(0, 100)}`);
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

      for (const [pool, poolLogs] of busy) {
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

        for (let i = 0; i + 2 < rows.length && found < LIMIT; i++) {
          const [front, victim, back] = [rows[i], rows[i + 1], rows[i + 2]];
          if (victim.idx !== front.idx + 1 || back.idx !== victim.idx + 1) continue;
          if (!front.from || front.from !== back.from || victim.from === front.from) continue;

          const side0 = front.a0In > 0n;
          const profitable = side0
            ? victim.a0In > 0n && back.a0Out > front.a0In
            : front.a1In > 0n && victim.a1In > 0n && back.a1Out > front.a1In;
          if (!profitable) continue;

          const profit = side0 ? back.a0Out - front.a0In : back.a1Out - front.a1In;
          const pair = await describePair(pool);
          const spent = pair ? (side0 ? pair.token0 : pair.token1) : null;
          const priceable = spent ? spent.decimals === 18 : false;

          found++;
          console.log(`SANDWICH  block ${height}  indices ${front.idx},${victim.idx},${back.idx}`);
          console.log(`  pool      ${pool}${pair ? `  ${pair.token0.symbol}/${pair.token1.symbol}` : ''}`);
          console.log(`  attacker  ${front.from}`);
          console.log(`  victim    ${victim.from}`);
          console.log(
            `  extracted ${profit} ${spent?.symbol ?? '?'} (side0=${side0}` +
              `, ${spent?.decimals ?? '?'} decimals)`,
          );
          if (!priceable) {
            console.log('  NOTE      the deployed rule prices the 18-decimal side; this window is on the other side');
          } else {
            console.log(`  prosecute node scripts/watch-address.mjs ${pool} --label "UniV2 ${pair.token0.symbol}/${pair.token1.symbol}"`);
          }
          console.log(`    ${front.hash}\n    ${victim.hash}\n    ${back.hash}\n`);
        }
      }
    }
  }

  if (found === 0) console.log('no sandwich in this window — widen it with --span, or drop --pool\n');
}

main().catch((e) => {
  console.error('scan failed:', e.shortMessage ?? e.message);
  process.exit(1);
});
