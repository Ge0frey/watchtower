/**
 * Day 1: prove the thesis, build nothing else.
 *
 * Watchtower rests on one claim - that a Creditcoin contract can know where an Ethereum transaction
 * sat inside its block, and therefore which transactions were its neighbours. This script asserts
 * that three independent sources agree on that coordinate:
 *
 *     SDK ContinuityResponse.txIndex  ==  VERIFIER.calculateTxIndex(merkleProof)  ==  the real index
 *
 * and that a three-transaction window verifies through the precompile's BATCH overload with a single
 * shared continuity proof.
 *
 * If this passes, everything downstream is real. If it fails, stop and re-plan.
 *
 *   pnpm thesis 0xFRONTRUN 0xVICTIM 0xBACKRUN      (defaults to chainKey 3, Ethereum Mainnet)
 */
import { Contract, JsonRpcProvider } from 'ethers';
import { assertSupportedChains, attestedHead, createClient } from '../client.js';
import { buildEvidenceBundle } from '../proofs.js';
import { preflight } from '../preflight.js';
import { env } from '../env.js';

const PRECOMPILE = '0x0000000000000000000000000000000000000FD2';

/** Only the two functions this script needs, transcribed from the canonical interface. */
const VERIFIER_ABI = [
  'function calculateTxIndex((bytes32 root,(bytes32 hash,bool isLeft)[] siblings) merkleProof) view returns (uint64)',
  'function verify(uint64 chainKey, uint64[] heights, bytes[] encodedTransactions, (bytes32 root,(bytes32 hash,bool isLeft)[] siblings)[] merkleProofs, (bytes32 lowerEndpointDigest,bytes32[] roots) sharedContinuityProof) view returns (bool)',
];

function ok(label: string, passed: boolean, detail = '') {
  console.log(`${passed ? '  PASS' : '  FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!passed) process.exitCode = 1;
}

async function main() {
  const hashes = process.argv.slice(2).filter((a) => a.startsWith('0x'));
  const chainKey = (process.env.THESIS_CHAIN_KEY ? Number(process.env.THESIS_CHAIN_KEY) : 3) as 1 | 3;

  if (hashes.length === 0) {
    console.error('usage: pnpm thesis <txHash> [txHash ...]   (2-10 hashes exercise the batch path)');
    process.exit(2);
  }

  console.log('\nWATCHTOWER - Day 1 thesis check');
  console.log('================================\n');

  const client = createClient();

  const net = await client.creditcoin.getNetwork();
  ok('Creditcoin reachable', true, `chainId ${net.chainId}`);
  ok('chainId is CC3 Testnet (102031)', Number(net.chainId) === 102031);

  await assertSupportedChains(client);
  ok('chainKey 1 -> Sepolia, chainKey 3 -> Mainnet', true);

  const head = await attestedHead(client, chainKey);
  ok(`attested head for chainKey ${chainKey}`, head > 0, `block ${head.toLocaleString()}`);

  // --- build the bundle ------------------------------------------------------
  console.log('\nbuilding evidence bundle...');
  const bundle = await buildEvidenceBundle(client, chainKey, hashes, {
    waiting: (h, attested) =>
      console.log(
        `  waiting for attestation of block ${h.toLocaleString()} ` +
          `(attested through ${attested.toLocaleString()}; ~8 min in practice)`,
      ),
    building: () => console.log('  building Merkle + continuity proofs'),
  });
  ok('proof bundle built', bundle.rows.length === hashes.length, `${bundle.rows.length} rows, cached=${bundle.cached}`);
  ok('one continuity proof shared by the window', true, `${bundle.continuityLength} roots`);

  // --- the assertion ---------------------------------------------------------
  console.log('\nthree-way transaction index check:');
  const sourceRpc = chainKey === 3 ? env.mainnetRpc() : env.sepoliaRpc();
  const source = new JsonRpcProvider(sourceRpc);
  const verifier = new Contract(PRECOMPILE, VERIFIER_ABI, client.creditcoin);
  const calculateTxIndex = verifier.getFunction('calculateTxIndex');

  for (const row of bundle.rows) {
    const receipt = await source.getTransactionReceipt(row.txHash);
    const truth = receipt?.index;
    const onChain = Number(
      await calculateTxIndex.staticCall({ root: row.merkleRoot, siblings: row.siblings }),
    );

    const agree = truth === row.txIndex && row.txIndex === onChain;
    ok(
      `${row.txHash.slice(0, 12)}…`,
      agree,
      `etherscan=${truth} sdk=${row.txIndex} precompile=${onChain}`,
    );
  }

  // --- batch verification ----------------------------------------------------
  console.log('\nbatch verification through the precompile:');
  const verified = await preflight(client, bundle);
  ok('verify(chainKey, heights[], txBytes[], proofs[], sharedContinuity)', verified);

  // --- adjacency -------------------------------------------------------------
  if (bundle.rows.length === 3) {
    const [a, b, c] = bundle.rows as [typeof bundle.rows[0], typeof bundle.rows[0], typeof bundle.rows[0]];
    const sameBlock = a.blockHeight === b.blockHeight && b.blockHeight === c.blockHeight;
    const consecutive = b.txIndex === a.txIndex + 1 && c.txIndex === b.txIndex + 1;
    ok('window is one block', sameBlock, `block ${a.blockHeight.toLocaleString()}`);
    ok('indices are consecutive', consecutive, `${a.txIndex}, ${b.txIndex}, ${c.txIndex}`);
    console.log(
      '\n  This is the fact no Ethereum contract can observe about its neighbours,',
      '\n  and the reason Watchtower can only be settled on Creditcoin.',
    );
  }

  console.log(
    process.exitCode === 1
      ? '\nTHESIS FAILED - stop and re-plan.\n'
      : '\nTHESIS HOLDS - the project is real.\n',
  );
}

main().catch((error) => {
  console.error('\nthesis check errored:', error instanceof Error ? error.message : error);
  process.exit(1);
});
