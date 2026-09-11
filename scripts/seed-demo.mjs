/**
 * Seed the vault so the dashboard opens alive: stake capital, fund bounty pools, buy cover.
 *
 * The ethers twin of `contracts/script/SeedDemo.s.sol`, for the same reason the deployer is:
 * Creditcoin omits `mixHash` from block headers, so `forge script` cannot fork the chain to run or to
 * track receipts.
 *
 * Idempotent per subject - it reads what is already staked, funded and covered, and only tops up the
 * difference, so re-running after a partial failure is safe.
 *
 *   node scripts/seed-demo.mjs            # full budget: 8.30 CTC
 *   SEED_SCALE_BPS=5000 node scripts/...  # half of everything
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Contract, JsonRpcProvider, Wallet, formatEther, parseEther } from 'ethers';

const ROOT = process.cwd();
const env = Object.fromEntries(
  readFileSync(resolve(ROOT, '.env'), 'utf8').split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '')];
    }),
);

const provider = new JsonRpcProvider(env.CC3_RPC, undefined, { staticNetwork: true });
const wallet = new Wallet(env.DEPLOYER_PK, provider);

const abi = JSON.parse(
  readFileSync(resolve(ROOT, 'contracts/out/UnderwritingVault.sol/UnderwritingVault.json'), 'utf8'),
).abi;
const vault = new Contract(env.UNDERWRITING_VAULT, abi, wallet);

const SCALE = BigInt(process.env.SEED_SCALE_BPS ?? env.SEED_SCALE_BPS ?? 10_000);
const scaled = (amount) => (amount * SCALE) / 10_000n;

/**
 * Cover is denominated in USD with 8 decimals and the premium is 1% of cover per 30 days, so the two
 * must scale together - halving only the premium would trip `PremiumTooLow`.
 */
const PLAN = [
  { key: 'SUBJECT_POOL', label: 'UniV2 USDC/WETH', stake: parseEther('3'), bounty: parseEther('0.5'), coverUsd: 2n * 10n ** 8n },
  { key: 'SUBJECT_BRIDGE', label: 'DemoBridge', stake: parseEther('3'), bounty: parseEther('0.5'), coverUsd: 2n * 10n ** 8n },
  { key: 'SUBJECT_ACCOUNT', label: 'Failed transactions', stake: parseEther('1'), bounty: parseEther('0.25'), coverUsd: 1n * 10n ** 8n },
];

const THIRTY_DAYS = 30n * 24n * 60n * 60n;

async function send(label, promise) {
  const tx = await promise;
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error(`${label} reverted in ${tx.hash}`);
  console.log(`  ${label.padEnd(44)} ${tx.hash}`);
}

async function main() {
  console.log(`\nseeding vault ${env.UNDERWRITING_VAULT}  (scale ${Number(SCALE) / 100}%)\n`);

  let budget = 0n;
  for (const p of PLAN) {
    budget += scaled(p.stake) + scaled(p.bounty) + scaled((await vault.usdToCtc(p.coverUsd)) / 100n);
  }
  const balance = await provider.getBalance(wallet.address);
  console.log(`  budget ${formatEther(budget)} CTC, deployer holds ${formatEther(balance)} CTC\n`);
  if (balance <= budget) throw new Error('deployer balance below budget - top up or lower SEED_SCALE_BPS');

  for (const p of PLAN) {
    const subjectId = env[p.key];
    if (!subjectId) throw new Error(`${p.key} missing from .env - run the deploy first`);
    console.log(`${p.label}`);

    const wantStake = scaled(p.stake);
    const haveStake = await vault.stakeOf(subjectId, wallet.address);
    if (haveStake < wantStake) {
      await send('stake', vault.stake(subjectId, { value: wantStake - haveStake }));
    } else {
      console.log(`  stake                                        already ${formatEther(haveStake)} CTC`);
    }

    const wantBounty = scaled(p.bounty);
    const haveBounty = await vault.bountyPool(subjectId);
    if (haveBounty < wantBounty) {
      await send('fundWatch', vault.fundWatch(subjectId, { value: wantBounty - haveBounty }));
    } else {
      console.log(`  fundWatch                                    already ${formatEther(haveBounty)} CTC`);
    }

    // Scale cover with the premium so the vault's 1%-per-30-days check still passes.
    const coverUsd = scaled(p.coverUsd);
    const haveCover = await vault.coverOf(subjectId, wallet.address);
    if (haveCover < coverUsd) {
      const premium = ((await vault.usdToCtc(coverUsd)) * THIRTY_DAYS) / (100n * THIRTY_DAYS);
      await send('buyCover', vault.buyCover(subjectId, coverUsd, THIRTY_DAYS, { value: premium }));
    } else {
      console.log(`  buyCover                                     already $${Number(haveCover) / 1e8}`);
    }
    console.log('');
  }

  const vaultBalance = await provider.getBalance(env.UNDERWRITING_VAULT);
  console.log(`vault now holds ${formatEther(vaultBalance)} CTC\n`);
}

main().catch((e) => {
  console.error('\nseed failed:', e.shortMessage ?? e.message);
  console.error('re-run to resume - already-seeded subjects are skipped.');
  process.exit(1);
});
