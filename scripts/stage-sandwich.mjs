/**
 * Stage a prosecutable sandwich, end to end, in one command.
 *
 * `find-sandwich.mjs` reports what the MEV bots did in the last few minutes. Turning one of those
 * into something the UI can actually judge takes three more steps - register the pool, select it in
 * the dropdown, paste the hashes - and two of those steps have silent failure modes that have both
 * already happened during preparation:
 *
 *   1. A pool the deployed rule cannot price. `IntraBlockExtraction` is wired to one side of the pair
 *      and to the ETH/USD feed, so a pool quoted in anything but WETH gets its extraction multiplied
 *      by the price of ether. IQ/FRAX reports ~$521 for a $0.21 sandwich. It does not revert.
 *   2. The wrong subject selected. The rule finds no swaps on `subject.sourceContract`, returns
 *      "not violated", and the chain records an accepted-but-empty incident. No revert, no error.
 *
 * Neither is caught by the contracts, so both are caught here.
 *
 *   node scripts/stage-sandwich.mjs                    # scan, register the best, print a deep link
 *   node scripts/stage-sandwich.mjs --dry-run          # scan and report, register nothing
 *   node scripts/stage-sandwich.mjs --span 400 --stake 2
 *
 * Flags: --span · --from · --limit · --bounty · --stake · --cap · --worker · --site · --dry-run ·
 *        --allow-unpriced
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AbiCoder, Contract, JsonRpcProvider, formatEther, keccak256 } from 'ethers';
import { scanSandwiches } from './lib/sandwich.mjs';

const run = promisify(execFile);
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
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const has = (n) => argv.includes(`--${n}`);

const SPAN = Number(flag('span', '150'));
const LIMIT = Number(flag('limit', '12'));
const BOUNTY = flag('bounty', '0.25');
// watch-address defaults --stake to 0, which leaves a tranche with nothing to pay from. A subject
// staged for a demo should be able to settle, so this one defaults it to 1.
const STAKE = flag('stake', '1');
const CAP = flag('cap', '100');
const DRY = has('dry-run');
const ALLOW_UNPRICED = has('allow-unpriced');
const SITE = flag('site', 'https://watchtower-attestation.vercel.app');
const WORKER = flag('worker', env.NEXT_PUBLIC_WORKER_API_URL || env.WORKER_API_URL || '');
const LOG_RANGE = Number(env.LOG_RANGE ?? 10);

/** Mainnet WETH. The token the ETH/USD feed actually prices. */
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'.toLowerCase();
const CHAIN_KEY_MAINNET = 3;

const mainnet = new JsonRpcProvider(env.MAINNET_RPC);
const cc3 = new JsonRpcProvider(env.CC3_RPC, undefined, { staticNetwork: true });

const RULE_ABI = [
  'function ruleId() view returns (bytes32)',
  'function PRICED_SIDE_IS_TOKEN0() view returns (bool)',
  'function TOKEN_DECIMALS() view returns (uint8)',
];
const CORE_ABI = [
  'function stateOf(bytes32) view returns (tuple(uint256 locked,uint256 minted,uint256 price,uint64 cursorHeight,uint32 cursorIndex))',
];
const REGISTRY_ABI = [
  'function getSubject(bytes32) view returns (tuple(uint8 kind,uint64 chainKey,address sourceContract,bytes32 boundRule,uint64 anchorHeight,uint32 anchorIndex,uint256 payoutCapPerBlock,bytes32 priceSubject,bool active,string label))',
  'function exists(bytes32) view returns (bool)',
];

const subjectIdOf = (ck, source, ruleId) =>
  keccak256(AbiCoder.defaultAbiCoder().encode(['uint64', 'address', 'bytes32'], [ck, source, ruleId]));

const usd = (n) => `$${(Number(n) / 1e8).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * How far Creditcoin has actually verified mainnet.
 *
 * The worker already exposes this, and asking it costs one request. When it is asleep or unset we
 * fall back to treating anything within 50 blocks of the head as too fresh, which is conservative
 * against the ~8 minute attestation lag rather than precise.
 */
async function attestedHead(head) {
  if (WORKER) {
    try {
      const res = await fetch(`${WORKER.replace(/\/$/, '')}/api/health`, { signal: AbortSignal.timeout(15_000) });
      const body = await res.json();
      const h = Number(body?.attestedHeads?.['3'] ?? 0);
      if (h > 0) return { height: h, source: 'worker' };
    } catch { /* fall through */ }
  }
  return { height: head - 50, source: 'heuristic' };
}

async function main() {
  const ruleAddress = env.RULE_INTRABLOCK;
  if (!ruleAddress) throw new Error('RULE_INTRABLOCK is not set in .env');

  // Read the rule's pricing configuration rather than assuming today's values, so the guard stays
  // correct if the rule is ever redeployed against the other side of the pair.
  const rule = new Contract(ruleAddress, RULE_ABI, cc3);
  const [ruleId, pricedSideIsToken0, tokenDecimals] = await Promise.all([
    rule.ruleId(), rule.PRICED_SIDE_IS_TOKEN0(), rule.TOKEN_DECIMALS(),
  ]);

  const core = new Contract(env.WATCHTOWER_CORE, CORE_ABI, cc3);
  const feed = await core.stateOf(env.SUBJECT_FEED);
  const price = feed.price; // 1e8
  if (price === 0n) console.log('  note: no proven price yet, damages below are unavailable\n');

  const head = await mainnet.getBlockNumber();
  const safeHead = head - 8;
  const from = Number(flag('from', String(safeHead - SPAN)));
  const attested = await attestedHead(head);

  console.log(`\nscanning every UniV2-style pool, blocks ${from}..${safeHead}`);
  console.log(`  rule prices ${pricedSideIsToken0 ? 'token0' : 'token1'} at ${tokenDecimals} decimals, must be WETH`);
  console.log(`  attested through ${attested.height.toLocaleString()} (${attested.source})\n`);

  const usable = [];
  for await (const hit of scanSandwiches({
    provider: mainnet, from, to: safeHead, limit: LIMIT, logRange: LOG_RANGE,
    onSliceError: (s, e) => console.error(`  slice ${s} failed`),
  })) {
    const name = hit.pair ? `${hit.pair.token0.symbol}/${hit.pair.token1.symbol}` : hit.pool.slice(0, 10);
    const damages = price > 0n ? (hit.profit * price) / 10n ** BigInt(tokenDecimals) : 0n;

    // The rule only judges a window extracted on the side it can price.
    if (hit.side0 !== pricedSideIsToken0) {
      console.log(`  skipped  ${name.padEnd(14)} extracted on the side this rule does not price`);
      continue;
    }
    // And that side's token must be the one the feed actually prices.
    const spentToken = (hit.spent?.address ?? '').toLowerCase();
    if (spentToken !== WETH) {
      console.log(`  skipped  ${name.padEnd(14)} quoted in ${hit.spent?.symbol ?? '?'}, not WETH`);
      console.log(`           the deployed rule would report ${usd(damages)} for this window`);
      if (!ALLOW_UNPRICED) continue;
      console.log('           --allow-unpriced given, keeping it anyway');
    }
    if (hit.height > attested.height) {
      const mins = Math.max(1, Math.ceil(((hit.height - attested.height) * 12) / 60));
      console.log(`  skipped  ${name.padEnd(14)} block ${hit.height} not attested yet, ready in ~${mins} min`);
      continue;
    }
    usable.push({ ...hit, name, damages });
  }

  if (usable.length === 0) {
    console.log('\nnothing usable in this window. Widen it with --span, or wait for attestation.\n');
    process.exit(1);
  }

  // Biggest extraction wins: the damages figure is the number a judge reads.
  usable.sort((a, b) => (b.damages > a.damages ? 1 : -1));
  const best = usable[0];
  const hashes = [best.front.hash, best.victim.hash, best.back.hash];
  const label = `UniV2 ${best.name}`;

  console.log(`\n  BEST     ${best.name.padEnd(14)} block ${best.height}  indices ${best.front.idx},${best.victim.idx},${best.back.idx}`);
  console.log(`           extracted ${formatEther(best.profit)} ${best.spent?.symbol ?? '?'}  ->  ${usd(best.damages)}\n`);

  if (DRY) {
    console.log('--dry-run: registering nothing\n');
    return;
  }

  console.log(`registering ${best.pool}`);
  const { stdout } = await run('node', [
    'scripts/watch-address.mjs', best.pool,
    '--label', label, '--bounty', BOUNTY, '--stake', STAKE, '--cap', CAP,
  ], { cwd: ROOT });
  process.stdout.write(stdout.split('\n').filter((l) => l.trim().startsWith('0x') || l.includes('  ')).join('\n'));

  // Assert the registry agrees before printing anything pasteable. A subject whose sourceContract is
  // not this pool would produce the silent not-violated outcome the whole script exists to prevent.
  const subjectId = subjectIdOf(CHAIN_KEY_MAINNET, best.pool, ruleId);
  const registry = new Contract(env.SUBJECT_REGISTRY, REGISTRY_ABI, cc3);
  const subject = await registry.getSubject(subjectId);
  if (subject.sourceContract.toLowerCase() !== best.pool.toLowerCase()) {
    throw new Error(`registry disagrees: subject watches ${subject.sourceContract}, sandwich is on ${best.pool}`);
  }
  if (Number(subject.chainKey) !== CHAIN_KEY_MAINNET) {
    throw new Error(`registry disagrees: subject chainKey is ${subject.chainKey}, expected ${CHAIN_KEY_MAINNET}`);
  }

  const link = `${SITE}/prosecute?subject=${subjectId}&tx=${hashes.join(',')}`;
  console.log('\n\nREADY TO PROSECUTE');
  console.log(`  subject   ${subject.label}      <- this one in the dropdown`);
  console.log(`  watching  ${subject.sourceContract}`);
  console.log(`  damages   ~${usd(best.damages)}`);
  console.log('\n  open this and both fields are already filled in:\n');
  console.log(`  ${link}\n`);
  console.log('  or paste these by hand, with the subject above selected:\n');
  for (const h of hashes) console.log(`    ${h}`);
  console.log('');
}

main().catch((e) => {
  console.error('\nstage failed:', e.shortMessage ?? e.message, '\n');
  process.exit(1);
});
