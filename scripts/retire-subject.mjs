/**
 * Retire a subject, so the catalogue does not fill up with pools from old rehearsals.
 *
 * Every staged sandwich registers a new pool, and `SubjectRegistry` only ever pushes - there is no
 * removal, by design, because an id that could disappear would make every incident that referenced it
 * unreadable. What there is instead is `setSubjectActive`, which leaves the record intact and its
 * history readable while taking it out of circulation.
 *
 * Retiring does not touch money:
 *   - staked CTC is still withdrawable, because `unstake` gates on `frozen`, not on `active`
 *   - the bounty pool stays where it is. `fundWatch` has no matching withdraw at all, so a funded
 *     bounty can only ever leave by being paid to a prosecutor. That is true whether or not you
 *     retire, so retiring costs nothing you had not already spent.
 *
 *   node scripts/retire-subject.mjs 0xPOOL              # take it out of the dropdown
 *   node scripts/retire-subject.mjs 0xPOOL --activate   # put it back
 *   node scripts/retire-subject.mjs 0xSUBJECT_ID        # by id, for non-pool subjects
 *
 * Flags: --kind pool|custodian|feed|account (default pool) · --chain mainnet|sepolia · --activate
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AbiCoder, Contract, JsonRpcProvider, formatEther, isAddress, keccak256 } from 'ethers';

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
const target = argv.find((a) => a.startsWith('0x'));
const flag = (n, d) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const ACTIVATE = argv.includes('--activate');

if (!target) {
  console.error('usage: node scripts/retire-subject.mjs 0xPOOL_OR_SUBJECT_ID [--activate]');
  console.error('                                       [--kind pool|custodian|feed|account] [--chain mainnet|sepolia]');
  process.exit(2);
}

const RULE_FOR_KIND = { pool: 'RULE_INTRABLOCK', custodian: 'RULE_RESERVE', feed: 'RULE_FEED', account: 'RULE_FAILEDTX' };
const kind = (flag('kind', 'pool') ?? 'pool').toLowerCase();
if (!(kind in RULE_FOR_KIND)) throw new Error(`unknown --kind ${kind}`);
const chainKey = (flag('chain', 'mainnet') ?? 'mainnet').toLowerCase() === 'sepolia' ? 1 : 3;

const provider = new JsonRpcProvider(env.CC3_RPC, undefined, { staticNetwork: true });
const { Wallet } = await import('ethers');
const wallet = new Wallet(env.DEPLOYER_PK, provider);

const artifact = (name) =>
  JSON.parse(readFileSync(resolve(ROOT, 'contracts/out', `${name}.sol`, `${name}.json`), 'utf8')).abi;

const registry = new Contract(env.SUBJECT_REGISTRY, artifact('SubjectRegistry'), wallet);
const vault = new Contract(env.UNDERWRITING_VAULT, artifact('UnderwritingVault'), provider);

async function main() {
  // A 32-byte value is already a subject id; a 20-byte one is a contract we derive the id from.
  let subjectId = target;
  if (isAddress(target)) {
    const rule = new Contract(env[RULE_FOR_KIND[kind]], artifact('IConservationRule'), provider);
    const ruleId = await rule.ruleId();
    subjectId = keccak256(AbiCoder.defaultAbiCoder().encode(['uint64', 'address', 'bytes32'], [chainKey, target, ruleId]));
  }

  if (!(await registry.exists(subjectId))) throw new Error(`no such subject: ${subjectId}`);
  const subject = await registry.getSubject(subjectId);

  /**
   * Refuse to retire a subject the worker is still scanning.
   *
   * The three scanners are wired to fixed subjects from `.env`, not to whatever the registry happens
   * to hold, so retiring one does not stop it being scanned. It keeps finding candidates, keeps
   * submitting them, and every submission reverts with `SubjectInactive` - which the queue treats as
   * a transient failure and retries with backoff up to six times. That is real CTC, burned in a loop,
   * for evidence that can never be accepted.
   */
  const scanned = {
    SUBJECT_POOL: 'the intra-block scanner',
    SUBJECT_BRIDGE: 'the reserve stream scanner',
    SUBJECT_FEED: 'the price feed scanner',
  };
  const wired = Object.entries(scanned).find(([key]) => (env[key] ?? '').toLowerCase() === subjectId.toLowerCase());
  if (wired && !ACTIVATE && !argv.includes('--force')) {
    console.error(`\nrefusing: ${subject.label} is what ${wired[1]} is pointed at (${wired[0]} in .env).`);
    console.error('Retiring it does not stop the scan. The worker would keep submitting evidence that');
    console.error('reverts with SubjectInactive, retried six times each, burning CTC for nothing.');
    console.error('\nPoint that scanner elsewhere first, or disable it, or pass --force if you know why.\n');
    process.exit(1);
  }

  console.log(`\n${ACTIVATE ? 'restoring' : 'retiring'} ${subject.label}`);
  console.log(`  subject    ${subjectId}`);
  console.log(`  watching   ${subject.sourceContract}`);
  console.log(`  active     ${subject.active} -> ${ACTIVATE}`);

  if (subject.active === ACTIVATE) {
    console.log(`\n  already ${ACTIVATE ? 'active' : 'retired'} — nothing to do\n`);
    return;
  }

  const tx = await registry.setSubjectActive(subjectId, ACTIVATE);
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error(`setSubjectActive reverted in ${tx.hash}`);
  console.log(`  setSubjectActive               ${tx.hash}`);

  if (!ACTIVATE) {
    const tranche = await vault.tranches(subjectId);
    const bounty = await vault.bountyPool(subjectId);
    console.log('\n  out of the dropdown and off the catalogue. Still reachable by direct link,');
    console.log('  and still listed in the Vault so nothing is hidden from whoever funded it.\n');
    if (tranche.staked > 0n) {
      console.log(`  ${formatEther(tranche.staked)} CTC is still staked here and is still withdrawable:`);
      console.log('  open it from the Vault tranches table and unstake as normal.');
    }
    if (bounty > 0n) {
      console.log(`  ${formatEther(bounty)} CTC sits in the bounty pool and stays there. A funded bounty`);
      console.log('  can only ever be paid to a prosecutor, retired or not.');
    }
    console.log('');
  } else {
    console.log('\n  back in the dropdown and on the catalogue.\n');
  }
}

main().catch((e) => {
  console.error('\nretire failed:', e.shortMessage ?? e.message, '\n');
  process.exit(1);
});
