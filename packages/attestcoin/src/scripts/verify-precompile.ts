/**
 * Live conformance check for the Block Prover Precompile.
 *
 * Watchtower's unit tests run offline against an etched `MockBlockProver`, because Creditcoin's
 * precompile is native runtime code and a forked node would not have it. That is only sound if the
 * mock derives transaction indices the same way the real thing does.
 *
 * This script asks the live precompile at 0x0FD2 to read back sibling paths built for known indices.
 * If every answer matches, the offline suite is faithful to the chain.
 *
 *   pnpm --filter @watchtower/attestcoin exec tsx src/scripts/verify-precompile.ts
 */
import { Contract, JsonRpcProvider, keccak256, toUtf8Bytes } from 'ethers';
import { env } from '../env.js';

const ABI = [
  'function calculateTxIndex((bytes32 root,(bytes32 hash,bool isLeft)[] siblings) merkleProof) view returns (uint64)',
];

/**
 * Walking a Merkle path from the leaf upward, a sibling on the left means this node was the right
 * child - so bit `k` of the index is set. `MockBlockProver._index` implements exactly this.
 */
function siblingsForIndex(index: number, depth = 12) {
  return Array.from({ length: depth }, (_, k) => ({
    hash: keccak256(toUtf8Bytes(`sibling-${index}-${k}`)),
    isLeft: ((index >> k) & 1) === 1,
  }));
}

async function main() {
  const provider = new JsonRpcProvider(env.cc3Rpc);
  const verifier = new Contract('0x0000000000000000000000000000000000000FD2', ABI, provider);
  const calculateTxIndex = verifier.getFunction('calculateTxIndex');

  const chainId = Number((await provider.getNetwork()).chainId);
  console.log(`\nBlock Prover Precompile 0x0FD2 on chainId ${chainId}\n`);

  let allMatch = true;
  for (const index of [0, 1, 2, 46, 47, 48, 127, 1023, 4095]) {
    const returned = Number(
      await calculateTxIndex.staticCall({
        root: keccak256(toUtf8Bytes('root')),
        siblings: siblingsForIndex(index),
      }),
    );
    const match = returned === index;
    allMatch &&= match;
    console.log(
      `  expected ${String(index).padStart(4)}   precompile ${String(returned).padStart(4)}   ${match ? 'MATCH' : 'MISMATCH'}`,
    );
  }

  if (allMatch) {
    console.log('\nThe precompile uses the same convention as MockBlockProver.');
    console.log('The offline unit suite is faithful to on-chain behaviour.\n');
  } else {
    console.log('\nConvention differs. Fix MockBlockProver._index before trusting the offline suite.\n');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('verification failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
