import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { createPublicClient, http, type Address, type Hex } from 'viem';
import {
  creditcoinTestnet,
  subjectRegistryAbi,
  underwritingVaultAbi,
  watchtowerCoreAbi,
} from '@watchtower/shared';
import { config } from './config.js';

/**
 * Two clients on purpose.
 *
 * viem reads our own contracts - better types, `multicall` for whole-dashboard snapshots. ethers
 * writes them, because the Attestcoin SDK is ethers-only and its gas helper takes an ethers Contract.
 * Mixing them in one process is fine and keeps each library where it is strongest.
 */
export const publicClient = createPublicClient({
  chain: creditcoinTestnet,
  transport: http(config.cc3Rpc),
});

export const ethersProvider = new JsonRpcProvider(config.cc3Rpc);

let wallet: Wallet | null = null;
export function prosecutorWallet(): Wallet {
  if (!wallet) {
    const pk = process.env.PROSECUTOR_PK;
    if (!pk) throw new Error('PROSECUTOR_PK is not set - the worker cannot submit evidence');
    wallet = new Wallet(pk, ethersProvider);
  }
  return wallet;
}

/**
 * The core, as ethers sees it.
 *
 * Only the two entrypoints the worker uses. Hand-written rather than generated because the SDK's gas
 * helper needs an ethers `Contract` and the full ABI is not required to build calldata.
 */
export const CORE_WRITE_ABI = [
  'function submitEvidence((bytes32 subjectId,bytes32 ruleId,uint64 chainKey,uint64[] blockHeights,bytes[] encodedTxs,bytes32[] merkleRoots,(bytes32 hash,bool isLeft)[][] siblings,bytes32 lowerEndpointDigest,bytes32[] continuityRoots) input) payable returns (bytes32)',
  'function challengeGap(bytes32 incidentId,(bytes32 subjectId,bytes32 ruleId,uint64 chainKey,uint64[] blockHeights,bytes[] encodedTxs,bytes32[] merkleRoots,(bytes32 hash,bool isLeft)[][] siblings,bytes32 lowerEndpointDigest,bytes32[] continuityRoots) gapEvidence)',
  'function settleBreach(bytes32 incidentId)',
];

export function coreContract(signer = prosecutorWallet()): Contract {
  return new Contract(config.deployment.watchtowerCore, CORE_WRITE_ABI, signer);
}

export const contracts = {
  core: { address: config.deployment.watchtowerCore as Address, abi: watchtowerCoreAbi },
  registry: { address: config.deployment.subjectRegistry as Address, abi: subjectRegistryAbi },
  vault: { address: config.deployment.underwritingVault as Address, abi: underwritingVaultAbi },
} as const;

/**
 * Every subject in the catalogue, with its live accumulator.
 *
 * `allSubjects` returns the whole registry in one call and `multicall` batches the accumulator reads,
 * so a full dashboard snapshot costs two RPC round trips no matter how many subjects exist.
 */
export async function readSubjects() {
  const [ids, items] = await publicClient.readContract({
    ...contracts.registry,
    functionName: 'allSubjects',
  });

  const states = await publicClient.multicall({
    contracts: ids.map((id) => ({ ...contracts.core, functionName: 'stateOf', args: [id] }) as const),
    allowFailure: false,
  });

  return ids.map((id, i) => ({
    id,
    subject: items[i]!,
    state: states[i]!,
  }));
}

export async function readVaultTranche(subjectId: Hex) {
  return publicClient.readContract({
    ...contracts.vault,
    functionName: 'trancheOf',
    args: [subjectId],
  });
}

export async function readBountyPool(subjectId: Hex) {
  return publicClient.readContract({
    ...contracts.vault,
    functionName: 'bountyPool',
    args: [subjectId],
  }) as Promise<bigint>;
}
