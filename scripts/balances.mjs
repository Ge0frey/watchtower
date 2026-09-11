/**
 * Print the balance of every key in .env, on the chain that key actually spends on.
 *
 *   pnpm balances
 *
 * Reads .env directly so it works from any shell - fish does not source .env, which is the usual
 * reason a bare `cast balance --rpc-url $CC3_RPC` comes back empty-handed.
 * Private keys are read to derive addresses and are never printed.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatEther, JsonRpcProvider, Wallet } from 'ethers';

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      // strip an inline `# comment`, matching how dotenvy (forge) and dotenv (node) parse
      const raw = l.slice(i + 1).replace(/\s+#.*$/, '').trim();
      return [l.slice(0, i).trim(), raw.replace(/^["']|["']$/g, '')];
    }),
);

const CC3 = env.CC3_RPC ?? 'https://rpc.cc3-testnet.creditcoin.network';

const ROLES = [
  { key: 'DEPLOYER_PK', chain: 'creditcoin', symbol: 'CTC', rpc: CC3, need: 10, why: 'deploy + SeedDemo (8.30 CTC)' },
  { key: 'PROSECUTOR_PK', chain: 'creditcoin', symbol: 'CTC', rpc: CC3, need: 2, why: 'proof gas + 0.1 CTC bonds' },
  { key: 'SEPOLIA_DEMO_PK', chain: 'sepolia', symbol: 'ETH', rpc: env.SEPOLIA_RPC, need: 0.05, why: 'DemoBridge + staged incidents' },
];

const providers = new Map();
function providerFor(url) {
  if (!providers.has(url)) providers.set(url, new JsonRpcProvider(url, undefined, { staticNetwork: true }));
  return providers.get(url);
}

console.log('');
let allOk = true;

for (const role of ROLES) {
  const pk = env[role.key];
  if (!pk) { console.log(`  ${role.key.padEnd(16)} not set in .env`); allOk = false; continue; }
  if (!role.rpc) { console.log(`  ${role.key.padEnd(16)} no RPC configured for ${role.chain}`); allOk = false; continue; }

  let address;
  try { address = new Wallet(pk).address; }
  catch { console.log(`  ${role.key.padEnd(16)} invalid private key`); allOk = false; continue; }

  try {
    const balance = await providerFor(role.rpc).getBalance(address);
    const value = Number(formatEther(balance));
    const ok = value >= role.need;
    allOk &&= ok;
    console.log(
      `  ${ok ? 'OK  ' : 'LOW '} ${role.key.padEnd(16)} ${address}  ` +
      `${value.toFixed(4).padStart(10)} ${role.symbol.padEnd(4)} (need ~${role.need})  ${role.why}`,
    );
  } catch (error) {
    allOk = false;
    console.log(`  ERR  ${role.key.padEnd(16)} ${address}  ${error.shortMessage ?? error.message}`);
  }
}

console.log(allOk ? '\nAll funded. Deploy Sepolia first.\n' : '\nSomething is short - top up, or lower SEED_SCALE_BPS.\n');
process.exit(allOk ? 0 : 1);
