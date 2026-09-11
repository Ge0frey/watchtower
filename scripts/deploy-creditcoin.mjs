/**
 * Deploy Watchtower to Creditcoin, with ethers rather than `forge script`.
 *
 * Why not forge: Creditcoin's RPC omits `mixHash` from block headers, so alloy cannot deserialise a
 * single block ("missing field `mixHash`"). `forge script` forks the chain to execute `run()` and to
 * track receipts, so it fails or - worse - broadcasts transactions it cannot then follow, which is
 * how a half-finished deployment happens. ethers only needs eth_sendRawTransaction and
 * eth_getTransactionReceipt, both of which the chain serves correctly.
 *
 * Idempotent: any address already present in .env is reused rather than redeployed, so a partial run
 * resumes instead of orphaning contracts. Writes every result back to .env.
 *
 *   node scripts/deploy-creditcoin.mjs
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ContractFactory, Contract, JsonRpcProvider, Wallet, isAddress, keccak256, AbiCoder } from 'ethers';

const ROOT = process.cwd();
const ENV_PATH = resolve(ROOT, '.env');

// ------------------------------------------------------------------ env io

function readEnv() {
  return Object.fromEntries(
    readFileSync(ENV_PATH, 'utf8').split('\n')
      .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '')];
      }),
  );
}

function writeEnv(updates) {
  let text = readFileSync(ENV_PATH, 'utf8');
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    text = pattern.test(text) ? text.replace(pattern, line) : `${text.trimEnd()}\n${line}\n`;
  }
  writeFileSync(ENV_PATH, text);
}

function artifact(name) {
  const path = resolve(ROOT, 'contracts/out', `${name}.sol`, `${name}.json`);
  const a = JSON.parse(readFileSync(path, 'utf8'));
  return { abi: a.abi, bytecode: a.bytecode.object };
}

// --------------------------------------------------------------- deployment

const env = readEnv();
const provider = new JsonRpcProvider(env.CC3_RPC ?? 'https://rpc.cc3-testnet.creditcoin.network', undefined, {
  staticNetwork: true,
});
const wallet = new Wallet(env.DEPLOYER_PK, provider);
const updates = {};

async function send(label, promise) {
  const tx = await promise;
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error(`${label} reverted in ${tx.hash}`);
  console.log(`  ${label.padEnd(38)} ${tx.hash}`);
  return receipt;
}

async function deployOnce(envKey, name, args = []) {
  const existing = env[envKey];
  if (existing && isAddress(existing) && (await provider.getCode(existing)) !== '0x') {
    console.log(`  ${name.padEnd(24)} reusing ${existing}`);
    return new Contract(existing, artifact(name).abi, wallet);
  }
  const { abi, bytecode } = artifact(name);
  const contract = await new ContractFactory(abi, bytecode, wallet).deploy(...args);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`  ${name.padEnd(24)} deployed ${address}`);
  updates[envKey] = address;
  env[envKey] = address;
  return contract;
}

const subjectId = (chainKey, sourceContract, ruleId) =>
  keccak256(AbiCoder.defaultAbiCoder().encode(['uint64', 'address', 'bytes32'], [chainKey, sourceContract, ruleId]));

async function main() {
  const chainId = Number((await provider.getNetwork()).chainId);
  if (chainId !== 102031) throw new Error(`expected Creditcoin CC3 Testnet (102031), got ${chainId}`);
  console.log(`\nWATCHTOWER deploy -> chainId ${chainId}\ndeployer ${wallet.address}\n`);

  copyFileSync(ENV_PATH, `${ENV_PATH}.bak`);

  for (const key of ['DEMO_POOL_MAINNET', 'DEMO_AGGREGATOR_MAINNET', 'DEMO_BRIDGE_SEPOLIA', 'DEMO_FAILED_TX_WATCH']) {
    if (!isAddress(env[key] ?? '')) throw new Error(`${key} is not set to a valid address`);
  }

  // --- core ---------------------------------------------------------------
  const registry = await deployOnce('SUBJECT_REGISTRY', 'SubjectRegistry', [wallet.address]);
  const vault = await deployOnce('UNDERWRITING_VAULT', 'UnderwritingVault', [wallet.address, await registry.getAddress()]);
  const core = await deployOnce('WATCHTOWER_CORE', 'WatchtowerCore', [
    wallet.address, await registry.getAddress(), await vault.getAddress(), 600,
  ]);

  if ((await vault.core()) !== (await core.getAddress())) {
    await send('vault.setCore', vault.setCore(await core.getAddress()));
  } else {
    console.log('  vault.setCore                          already wired');
  }

  // --- rules --------------------------------------------------------------
  // Deployed after the core: rules resolve prices through its IAttestedFeed interface. No circularity
  // - the core discovers rules through the registry at call time.
  const coreAddress = await core.getAddress();
  const registryAddress = await registry.getAddress();

  const intraBlock = await deployOnce('RULE_INTRABLOCK', 'IntraBlockExtraction', [
    registryAddress, coreAddress, 18, false, // WETH side of the USDC/WETH pair; token0 is USDC (6dp)
  ]);
  const reserve = await deployOnce('RULE_RESERVE', 'ReserveConservation', [registryAddress, coreAddress, 18]);
  const feed = await deployOnce('RULE_FEED', 'ChainlinkFeed', [registryAddress]);
  const failedTx = await deployOnce('RULE_FAILEDTX', 'FailedTx', [registryAddress, coreAddress]);

  const rules = [
    ['intraBlock', intraBlock], ['reserve', reserve], ['feed', feed], ['failedTx', failedTx],
  ];
  const ruleIds = {};
  for (const [name, rule] of rules) {
    const id = await rule.ruleId();
    ruleIds[name] = id;
    if (!(await registry.ruleAllowed(id))) {
      await send(`registry.registerRule(${name})`, registry.registerRule(id, await rule.getAddress(), true));
    } else {
      console.log(`  registerRule(${name})`.padEnd(40), 'already registered');
    }
  }

  // --- subjects -----------------------------------------------------------
  // The feed subject first: every other subject denominates its damages with the price it carries.
  const SEPOLIA = 1, MAINNET = 3;
  const specs = [
    { key: 'SUBJECT_FEED', kind: 2, chainKey: MAINNET, source: env.DEMO_AGGREGATOR_MAINNET,
      rule: ruleIds.feed, anchor: BigInt(env.FEED_ANCHOR_HEIGHT ?? 0), cap: 10n ** 18n, label: 'Chainlink ETH/USD' },
    { key: 'SUBJECT_POOL', kind: 0, chainKey: MAINNET, source: env.DEMO_POOL_MAINNET,
      rule: ruleIds.intraBlock, anchor: 0n, cap: 100n * 10n ** 18n, label: 'UniV2 USDC/WETH' },
    { key: 'SUBJECT_BRIDGE', kind: 1, chainKey: SEPOLIA, source: env.DEMO_BRIDGE_SEPOLIA,
      rule: ruleIds.reserve, anchor: BigInt(env.BRIDGE_ANCHOR_HEIGHT ?? 0), cap: 100n * 10n ** 18n, label: 'DemoBridge (Sepolia)' },
    { key: 'SUBJECT_ACCOUNT', kind: 3, chainKey: SEPOLIA, source: env.DEMO_FAILED_TX_WATCH,
      rule: ruleIds.failedTx, anchor: 0n, cap: 50n * 10n ** 18n, label: 'Failed transactions' },
  ];

  for (const s of specs) {
    const id = subjectId(s.chainKey, s.source, s.rule);
    if (await registry.exists(id)) {
      console.log(`  subject ${s.label.padEnd(24)} already registered ${id}`);
    } else {
      await send(`registerSubject(${s.label})`,
        registry.registerSubject(s.kind, s.chainKey, s.source, s.rule, s.anchor, 0, s.cap, s.label));
    }
    updates[s.key] = id;
    env[s.key] = id;
  }

  // --- price links --------------------------------------------------------
  for (const key of ['SUBJECT_POOL', 'SUBJECT_BRIDGE', 'SUBJECT_ACCOUNT']) {
    const subject = await registry.getSubject(env[key]);
    if (subject.priceSubject !== env.SUBJECT_FEED) {
      await send(`setPriceSubject(${key})`, registry.setPriceSubject(env[key], env.SUBJECT_FEED));
    } else {
      console.log(`  setPriceSubject(${key})`.padEnd(40), 'already linked');
    }
  }

  // --- browser copies -----------------------------------------------------
  updates.NEXT_PUBLIC_WATCHTOWER_CORE = env.WATCHTOWER_CORE;
  updates.NEXT_PUBLIC_SUBJECT_REGISTRY = env.SUBJECT_REGISTRY;
  updates.NEXT_PUBLIC_UNDERWRITING_VAULT = env.UNDERWRITING_VAULT;

  writeEnv(updates);
  console.log(`\nwrote ${Object.keys(updates).length} values to .env (previous saved as .env.bak)`);
  console.log(`subjects registered: ${await registry.subjectCount()}\n`);
}

main().catch((e) => {
  console.error('\ndeploy failed:', e.shortMessage ?? e.message);
  console.error('re-run to resume - anything already on-chain is reused, not redeployed.');
  process.exit(1);
});
