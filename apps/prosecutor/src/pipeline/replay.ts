import { decodeErrorResult, encodeAbiParameters, keccak256, type Hex } from 'viem';
import { createClient, ProofError } from '@watchtower/attestcoin';
import { watchtowerCoreAbi, type Candidate, type ChainKey } from '@watchtower/shared';
import { contracts, publicClient } from '../chain.js';

/**
 * The replay guard, read from this side of the wire.
 *
 * `WatchtowerCore._consumeAll` burns every coordinate it judges, so a window can be prosecuted
 * exactly once per (rule, subject). Nothing upstream of the submission noticed: `preflight()` only
 * re-verifies Merkle and continuity proofs at the precompile, and `previewEvidence` never reads
 * `consumed`. A re-filed window therefore passed every check we had and reverted on-chain - six
 * times, once per retry, each one paying gas for a transaction that could not succeed.
 *
 * So the guard is mirrored here: the same key derivation as `libs/SubjectKey.sol`, read before
 * spending anything, and consulted again when a submission fails to decide whether retrying is
 * pointless.
 */

const source = createClient();

export interface Coordinate {
  blockHeight: number;
  txIndex: number;
  txHash: Hex;
}

/** A failure that will never succeed on a retry. The queue treats it as terminal on sight. */
export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentError';
  }
}

/**
 * Core errors that describe the submission itself rather than the moment it was made.
 *
 * Attestation lag, a proof-builder wobble or a nonce collision are worth another attempt. These are
 * not: the evidence is spent, the subject is gone, or the window was never judgeable in the first
 * place.
 */
const PERMANENT_ERRORS = new Set([
  'AlreadyConsumed',
  'SubjectInactive',
  'RuleNotAllowed',
  'RuleMismatch',
  'ChainKeyMismatch',
  'MalformedInput',
  'ReceiptNotSuccessful',
]);

/** Mirrors `SubjectKey.evidenceKey` - rule-scoped on purpose, see that library's header. */
export function evidenceKeyOf(
  ruleId: Hex,
  subjectId: Hex,
  chainKey: ChainKey,
  blockHeight: number,
  txIndex: number,
): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint64' }, { type: 'uint64' }, { type: 'uint32' }],
      [ruleId, subjectId, BigInt(chainKey), BigInt(blockHeight), txIndex],
    ),
  );
}

/** Mirrors `SubjectKey.incidentId`, so a rejection can name the verdict that already owns the window. */
export function incidentIdOf(ruleId: Hex, subjectId: Hex, blockHeight: number, firstIndex: number): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'string' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint64' }, { type: 'uint32' }],
      ['watchtower.incident', ruleId, subjectId, BigInt(blockHeight), firstIndex],
    ),
  );
}

/**
 * Where each transaction sits on the source chain.
 *
 * The coordinate - not the hash - is what the guard is keyed on, so this is the cheapest possible
 * question to ask before committing to a submission: one `eth_getTransactionByHash` per entry, and
 * no proof building at all.
 */
export async function coordinatesOf(chainKey: ChainKey, txHashes: string[]): Promise<Coordinate[]> {
  const provider = source.source(chainKey);
  return Promise.all(
    txHashes.map(async (hash) => {
      const tx = await provider.getTransaction(hash);
      if (!tx?.blockNumber) throw new ProofError(`transaction ${hash} is not mined on chainKey ${chainKey}`);
      return { blockHeight: tx.blockNumber, txIndex: tx.index, txHash: hash as Hex };
    }),
  );
}

/**
 * The first coordinate of this window the chain has already judged, or `null` when it is untouched.
 *
 * Issued in one tick so the batching transport folds the lot into a single HTTP round trip.
 */
export async function firstConsumed(
  ruleId: Hex,
  subjectId: Hex,
  chainKey: ChainKey,
  coords: Coordinate[],
): Promise<Coordinate | null> {
  const spent = await Promise.all(
    coords.map((c) =>
      publicClient.readContract({
        ...contracts.core,
        functionName: 'consumed',
        args: [evidenceKeyOf(ruleId, subjectId, chainKey, c.blockHeight, c.txIndex)],
      }),
    ),
  );
  const i = spent.findIndex(Boolean);
  return i === -1 ? null : coords[i]!;
}

/** Human-readable rejection for a window whose evidence is already spent. */
export function consumedMessage(ruleId: Hex, subjectId: Hex, coords: Coordinate[], spent: Coordinate): string {
  const first = coords.reduce((a, b) =>
    a.blockHeight < b.blockHeight || (a.blockHeight === b.blockHeight && a.txIndex < b.txIndex) ? a : b,
  );
  const incidentId = incidentIdOf(ruleId, subjectId, first.blockHeight, first.txIndex);
  return (
    `already prosecuted - evidence at ${spent.blockHeight}·${spent.txIndex} is spent ` +
    `for this rule and subject (incident ${incidentId.slice(0, 10)})`
  );
}

/** Revert data hides in a different place in every layer ethers passes an error through. */
function revertData(error: unknown): Hex | null {
  const seen = new Set<unknown>();
  const walk = (node: unknown, depth: number): Hex | null => {
    if (!node || typeof node !== 'object' || depth > 4 || seen.has(node)) return null;
    seen.add(node);
    const record = node as Record<string, unknown>;
    const data = record.data;
    if (typeof data === 'string' && data.startsWith('0x') && data.length >= 10) return data as Hex;
    for (const key of ['error', 'info', 'cause', 'shortMessage']) {
      const found = walk(record[key], depth + 1);
      if (found) return found;
    }
    return null;
  };
  return walk(error, 0);
}

/**
 * Is retrying this failure pointless?
 *
 * Decoding the revert is the direct answer, but `pallet-evm` does not reliably return revert data -
 * the failure that prompted all this came back with `data: null` - so a decode miss falls through to
 * asking the chain what it already knows: the evidence is spent, or the subject is no longer active.
 */
export async function isPermanent(candidate: Candidate, error: unknown): Promise<boolean> {
  if (error instanceof PermanentError) return true;
  if (error instanceof ProofError && !error.retryable) return true;

  const data = revertData(error);
  if (data) {
    try {
      const decoded = decodeErrorResult({ abi: watchtowerCoreAbi, data });
      if (PERMANENT_ERRORS.has(decoded.errorName)) return true;
    } catch {
      /* not one of ours; fall through to the chain */
    }
  }

  try {
    const chainKey = candidate.chainKey as ChainKey;
    const coords = await coordinatesOf(chainKey, candidate.txHashes);
    if (await firstConsumed(candidate.ruleId, candidate.subjectId, chainKey, coords)) return true;

    const subject = await publicClient.readContract({
      ...contracts.registry,
      functionName: 'getSubject',
      args: [candidate.subjectId],
    });
    return !subject.active;
  } catch {
    // The re-check itself failed, which says nothing about the submission. Let it retry.
    return false;
  }
}
