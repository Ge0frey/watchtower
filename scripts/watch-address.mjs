/**
 * Put Watchtower on a contract nobody has watched before — the "fund a watch" beat, as a command.
 *
 * The pitch promises anyone can pay to have any Ethereum contract watched, and the vault's
 * `fundWatch` delivers half of that: it moves CTC into a bounty pool. The other half is the subject
 * itself. A bounty keyed to a subject id that was never registered can never be collected, because
 * `submitEvidence` refuses evidence against an unknown subject — so funding a watch on a fresh
 * address means *registering* it first. `registerSubject` is owner-gated in v1 (see
 * SubjectRegistry's header for why, and the roadmap for how that opens up), which makes this an
 * operator command rather than a button.
 *
 *   node scripts/watch-address.mjs 0xPOOL --label "UniV2 DAI/WETH" --bounty 0.25
 *   node scripts/watch-address.mjs 0xBRIDGE --kind custodian --anchor 11681048 --bounty 0.5
 *
 * Flags: --kind pool|custodian|feed|account (default pool) · --chain mainnet|sepolia (default
 * mainnet) · --label · --bounty CTC · --cap CTC per block · --anchor source-chain height · --stake CTC
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AbiCoder, Contract, JsonRpcProvider, Wallet, formatEther, isAddress, keccak256, parseEther } from 'ethers';

const ROOT = process.cwd();

const env = Object.fromEntries(
  readFileSync(resolve(ROOT, '.env'), 'utf8').split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '')];
    }),
);

// ------------------------------------------------------------------- args

const argv = process.argv.slice(2);
const address = argv.find((a) => a.startsWith('0x') && a.length === 42);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

if (!address || !isAddress(address)) {
  console.error('usage: node scripts/watch-address.mjs 0xADDRESS [--kind pool|custodian|feed|account]');
  console.error('                                      [--chain mainnet|sepolia] [--label "..."]');
  console.error('                                      [--bounty 0.25] [--cap 100] [--anchor N] [--stake 0]');
  process.exit(2);
}

const KINDS = { pool: 0, custodian: 1, feed: 2, account: 3 };
const RULE_FOR_KIND = {
  pool: 'RULE_INTRABLOCK',
  custodian: 'RULE_RESERVE',
  feed: 'RULE_FEED',
  account: 'RULE_FAILEDTX',
};

const kind = (flag('kind', 'pool') ?? 'pool').toLowerCase();
if (!(kind in KINDS)) throw new Error(`unknown --kind ${kind}; expected one of ${Object.keys(KINDS).join(', ')}`);

const chainName = (flag('chain', 'mainnet') ?? 'mainnet').toLowerCase();
const chainKey = chainName === 'sepolia' ? 1 : 3;
const label = flag('label', `${kind} ${address.slice(0, 8)}…`);
const bounty = parseEther(flag('bounty', '0.25') ?? '0.25');
const stake = parseEther(flag('stake', '0') ?? '0');
const cap = parseEther(flag('cap', '100') ?? '100');
const anchor = BigInt(flag('anchor', '0') ?? '0');

// ------------------------------------------------------------------ setup

const provider = new JsonRpcProvider(env.CC3_RPC, undefined, { staticNetwork: true });
const wallet = new Wallet(env.DEPLOYER_PK, provider);

const artifact = (name) =>
  JSON.parse(readFileSync(resolve(ROOT, 'contracts/out', `${name}.sol`, `${name}.json`), 'utf8')).abi;

const registry = new Contract(env.SUBJECT_REGISTRY, artifact('SubjectRegistry'), wallet);
const vault = new Contract(env.UNDERWRITING_VAULT, artifact('UnderwritingVault'), wallet);

const subjectIdOf = (ck, source, ruleId) =>
  keccak256(AbiCoder.defaultAbiCoder().encode(['uint64', 'address', 'bytes32'], [ck, source, ruleId]));

async function send(labelText, promise) {
  const tx = await promise;
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error(`${labelText} reverted in ${tx.hash}`);
  console.log(`  ${labelText.padEnd(30)} ${tx.hash}`);
}

async function main() {
  const ruleAddress = env[RULE_FOR_KIND[kind]];
  if (!ruleAddress) throw new Error(`${RULE_FOR_KIND[kind]} is not set in .env — deploy first`);

  const rule = new Contract(ruleAddress, artifact('IConservationRule'), provider);
  const ruleId = await rule.ruleId();
  const subjectId = subjectIdOf(chainKey, address, ruleId);

  console.log(`\nwatching ${address} on ${chainName} (chainKey ${chainKey})`);
  console.log(`  rule       ${await rule.name()}  ${ruleId}`);
  console.log(`  subject    ${subjectId}`);
  console.log(`  funder     ${wallet.address}  ${formatEther(await provider.getBalance(wallet.address))} CTC\n`);

  if (await registry.exists(subjectId)) {
    console.log('  subject already registered — topping up the bounty only');
  } else {
    await send('registerSubject', registry.registerSubject(KINDS[kind], chainKey, address, ruleId, anchor, 0, cap, label));

    // Damages are judged in dollars, and the only dollar figure this system trusts is one it proved
    // itself. Point the new subject at the feed subject so its verdicts have a price to quote.
    if (kind !== 'feed' && env.SUBJECT_FEED) {
      await send('setPriceSubject', registry.setPriceSubject(subjectId, env.SUBJECT_FEED));
    }
  }

  if (stake > 0n) await send('stake', vault.stake(subjectId, { value: stake }));
  if (bounty > 0n) await send('fundWatch', vault.fundWatch(subjectId, { value: bounty }));

  const tranche = await vault.trancheOf(subjectId);
  console.log(`\n  bounty pool  ${formatEther(await vault.bountyPool(subjectId))} CTC`);
  console.log(`  staked       ${formatEther(tranche.staked)} CTC`);
  console.log(`\n  Anyone can now prosecute ${address} and collect. Subject id:\n\n    ${subjectId}\n`);
}

main().catch((e) => {
  console.error('\nwatch failed:', e.shortMessage ?? e.message);
  process.exit(1);
});
