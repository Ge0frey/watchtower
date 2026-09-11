/**
 * Stage the attack-your-own-system beat: submit a reserve step that deliberately skips an event.
 *
 * This is the honest half of the design, made operable. A stream claim depends on *completeness*, and
 * no proof system can demonstrate an absence - so Watchtower does not pretend the claim is
 * self-evident. It bonds it and leaves it challengeable. This script plays the dishonest prosecutor:
 * it finds the custodian transactions sitting after the proven cursor, ingests a later one while
 * stepping over an earlier one, and prints the coordinate it skipped.
 *
 * Paste that hash into the incident's Challenge panel and the fraud proof runs - a `SINGLE_TX`
 * window through the same `submitEvidence` machinery. Watchtower's defence runs on Watchtower.
 *
 *   pnpm demo:skip-gap
 *
 * Stage the events first, at T-20 so they are attested before you are on stage:
 *   cast send $DEMO_BRIDGE_SEPOLIA "lock()" --value 0.01ether ...
 *   cast send $DEMO_BRIDGE_SEPOLIA "mintUnbacked(address,uint256)" $HOLDER 20000000000000000 ...
 */
import { Contract, JsonRpcProvider, Wallet, id as keccakId } from 'ethers';
import { createClient } from '../client.js';
import { buildEvidenceBundle } from '../proofs.js';
import { preflight } from '../preflight.js';
import { toEvidenceInput } from '../encode.js';
import { gasLimitFor } from '../gas.js';
import { env } from '../env.js';

const CHAIN_KEY_SEPOLIA = 1 as const;

const CUSTODIAN_TOPICS = [
  'Locked(address,uint256)',
  'Unlocked(address,uint256)',
  'Minted(address,uint256)',
  'Burned(address,uint256)',
].map((sig) => keccakId(sig).toLowerCase());

const CORE_ABI = [
  'function stateOf(bytes32) view returns (tuple(uint256 locked,uint256 minted,uint256 price,uint64 cursorHeight,uint32 cursorIndex))',
  'function submitEvidence((bytes32 subjectId,bytes32 ruleId,uint64 chainKey,uint64[] blockHeights,bytes[] encodedTxs,bytes32[] merkleRoots,(bytes32 hash,bool isLeft)[][] siblings,bytes32 lowerEndpointDigest,bytes32[] continuityRoots) input) payable returns (bytes32)',
  'event EvidenceAccepted(bytes32 indexed subjectId,bytes32 indexed ruleId,bytes32 indexed incidentId,uint64 chainKey,uint64 blockHeight,uint32 txIndex,uint64 continuityLength)',
];

const RULE_RESERVE = keccakId('watchtower.rule.reserve-conservation.v1');

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not set`);
  return value;
}

/** `eth_getLogs` in slices the provider accepts - Alchemy's free tier caps the range at 10 blocks. */
async function logsInRange(source: JsonRpcProvider, address: string, from: number, to: number) {
  const span = Number(process.env.LOG_RANGE ?? 10);
  const out: { blockNumber: number; transactionIndex: number; transactionHash: string; topic: string }[] = [];
  for (let start = from; start <= to; start += span) {
    const end = Math.min(to, start + span - 1);
    const slice = await source.getLogs({ address, fromBlock: start, toBlock: end });
    for (const log of slice) {
      out.push({
        blockNumber: log.blockNumber,
        transactionIndex: log.transactionIndex,
        transactionHash: log.transactionHash,
        topic: (log.topics[0] ?? '').toLowerCase(),
      });
    }
  }
  return out
    .filter((l) => CUSTODIAN_TOPICS.includes(l.topic))
    .sort((a, b) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex);
}

async function main() {
  const subjectId = required('SUBJECT_BRIDGE');
  const bridge = required('DEMO_BRIDGE_SEPOLIA');
  const coreAddress = required('WATCHTOWER_CORE');
  const bond = BigInt(process.env.PROSECUTOR_BOND_WEI ?? '100000000000000000');

  console.log('\nWATCHTOWER - staging a stream step with a hole in it');
  console.log('===================================================\n');

  const client = createClient();
  const wallet = new Wallet(env.prosecutorPk(), client.creditcoin);
  const core = new Contract(coreAddress, CORE_ABI, wallet);

  const state = await core.getFunction('stateOf')(subjectId);
  const cursor = { height: Number(state.cursorHeight), index: Number(state.cursorIndex) };
  console.log(`  proven cursor    ${cursor.height}.${cursor.index}`);

  const source = new JsonRpcProvider(env.sepoliaRpc());
  const head = await source.getBlockNumber();
  const candidates = (await logsInRange(source, bridge, cursor.height, head)).filter(
    (l) => l.blockNumber > cursor.height || (l.blockNumber === cursor.height && l.transactionIndex > cursor.index),
  );

  // One transaction may carry several events; the window is a set of transactions.
  const unique: typeof candidates = [];
  for (const log of candidates) {
    if (!unique.some((u) => u.transactionHash === log.transactionHash)) unique.push(log);
  }

  if (unique.length < 2) {
    console.error(
      `\n  only ${unique.length} custodian transaction(s) after the cursor - need at least two.\n` +
        '  Stage them first (and give attestation ~8 minutes):\n' +
        `    cast send ${bridge} "lock()" --value 0.01ether --rpc-url $SEPOLIA_RPC --private-key $SEPOLIA_DEMO_PK\n` +
        `    cast send ${bridge} "mintUnbacked(address,uint256)" $HOLDER 20000000000000000 --rpc-url $SEPOLIA_RPC --private-key $SEPOLIA_DEMO_PK\n`,
    );
    process.exit(1);
  }

  const skipped = unique[0]!;
  const target = unique[unique.length - 1]!;

  console.log(`  skipping         block ${skipped.blockNumber} · index ${skipped.transactionIndex}`);
  console.log(`                   ${skipped.transactionHash}`);
  console.log(`  submitting       block ${target.blockNumber} · index ${target.transactionIndex}`);
  console.log(`                   ${target.transactionHash}\n`);

  const bundle = await buildEvidenceBundle(client, CHAIN_KEY_SEPOLIA, [target.transactionHash], {
    waiting: (h, attested) =>
      console.log(`  waiting for attestation of block ${h} (attested through ${attested})`),
    building: () => console.log('  building Merkle + continuity proofs'),
  });
  console.log(`  proof            ${bundle.continuityLength} continuity roots, cached=${bundle.cached}`);

  if (!(await preflight(client, bundle))) {
    console.error('\n  pre-flight failed - the evidence is not provable yet. Wait and retry.\n');
    process.exit(1);
  }

  const input = toEvidenceInput(bundle, subjectId as `0x${string}`, RULE_RESERVE as `0x${string}`);
  const calldata = core.interface.encodeFunctionData('submitEvidence', [input]);
  const gasLimit = await gasLimitFor(
    client.creditcoin,
    core,
    calldata,
    await wallet.getAddress(),
    bundle.continuityLength,
  );

  const tx = await core.getFunction('submitEvidence')(input, { value: bond, gasLimit });
  console.log(`  submitted        ${tx.hash}`);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`submission reverted: ${tx.hash}`);

  const accepted = receipt.logs
    .map((log: { topics: string[]; data: string }) => {
      try {
        return core.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed: { name: string } | null) => parsed?.name === 'EvidenceAccepted');

  const incidentId = accepted?.args?.incidentId as string | undefined;

  console.log(`\n  gas used         ${receipt.gasUsed}`);
  if (incidentId) console.log(`  incident         ${incidentId}`);
  console.log('\n  ---------------------------------------------------------------');
  console.log('  Now challenge it. Open the incident, paste this into the gap field:');
  console.log(`\n    ${skipped.transactionHash}\n`);
  console.log('  The accumulator rolls back to its snapshot and the bond becomes the');
  console.log("  challenger's. The fraud proof is an ordinary verified window.");
  console.log('  ---------------------------------------------------------------\n');
}

main().catch((error) => {
  console.error('\ndemo:skip-gap failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
