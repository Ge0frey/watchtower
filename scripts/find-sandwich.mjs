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
import { JsonRpcProvider } from 'ethers';
import { scanSandwiches } from './lib/sandwich.mjs';

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

const provider = new JsonRpcProvider(env.MAINNET_RPC);

/** Alchemy's free tier hard-caps a single `eth_getLogs` at a 10-block range. */
const LOG_RANGE = Number(env.LOG_RANGE ?? 10);

async function main() {
  const head = await provider.getBlockNumber();
  const safeHead = head - 8;
  const from = Number(flag('from', String(safeHead - SPAN)));
  console.log(`\nscanning ${POOL ?? 'every UniV2-style pool'}, blocks ${from}..${safeHead}\n`);

  let found = 0;
  for await (const hit of scanSandwiches({
    provider,
    from,
    to: safeHead,
    pool: POOL,
    limit: LIMIT,
    logRange: LOG_RANGE,
    onSliceError: (start, end, e) =>
      console.error(`  slice ${start}-${end} failed: ${(e.shortMessage ?? e.message).slice(0, 100)}`),
  })) {
    const { height, pool, pair, front, victim, back, side0, profit, spent, priceable } = hit;
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

  if (found === 0) console.log('no sandwich in this window — widen it with --span, or drop --pool\n');
}

main().catch((e) => {
  console.error('scan failed:', e.shortMessage ?? e.message);
  process.exit(1);
});
