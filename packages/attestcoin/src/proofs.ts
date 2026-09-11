import type { proofProvider } from '@gluwa/usc-sdk';
import type { ChainKey } from '@watchtower/shared';
import { attestcoin } from '@watchtower/shared';
import type { AttestcoinClient } from './client.js';

export class ProofError extends Error {
  constructor(message: string, readonly retryable = true) {
    super(message);
    this.name = 'ProofError';
  }
}

/** One entry of a verified window, flattened out of the SDK's nested batch result. */
export interface ProofRow {
  blockHeight: number;
  txIndex: number;
  txHash: string;
  txBytes: string;
  merkleRoot: string;
  siblings: { hash: string; isLeft: boolean }[];
}

export interface EvidenceBundle {
  chainKey: ChainKey;
  rows: ProofRow[];
  continuity: { lowerEndpointDigest: string; roots: string[] };
  /** Continuity length is the protocol's cost driver, so it also prices the prosecutor's bounty. */
  continuityLength: number;
  cached: boolean;
}

export interface ProgressSink {
  waiting?(blockHeight: number): void;
  building?(): void;
  ready?(bundle: EvidenceBundle): void;
}

/**
 * Turn transaction hashes into a submission-ready bundle.
 *
 * Waiting for attestation is the slow step and the one worth narrating: the protocol produces
 * attestations on roughly a two-minute cadence, but a given block becomes provable in about eight
 * minutes end to end - the timeout below mirrors the official examples (15s poll, 20m ceiling).
 */
export async function buildEvidenceBundle(
  client: AttestcoinClient,
  chainKey: ChainKey,
  txHashes: string[],
  progress: ProgressSink = {},
): Promise<EvidenceBundle> {
  if (txHashes.length === 0) throw new ProofError('empty window', false);
  if (txHashes.length > attestcoin.maxBatchSize) {
    throw new ProofError(`window of ${txHashes.length} exceeds MAX_BATCH_SIZE ${attestcoin.maxBatchSize}`, false);
  }

  const source = client.source(chainKey);
  const heights: number[] = [];
  for (const hash of txHashes) {
    const tx = await source.getTransaction(hash);
    if (!tx?.blockNumber) throw new ProofError(`transaction ${hash} is not mined on chainKey ${chainKey}`);
    heights.push(tx.blockNumber);
  }

  const span = Math.max(...heights) - Math.min(...heights);
  if (span > attestcoin.maxBatchRangeBlocks) {
    throw new ProofError(`window spans ${span} blocks, over MAX_BATCH_RANGE ${attestcoin.maxBatchRangeBlocks}`, false);
  }

  const builder = client.proofBuilder(chainKey);
  const target = Math.max(...heights);

  progress.waiting?.(target);
  await builder.waitUntilHeightAttested(chainKey, target, 15_000, 1_200_000);

  progress.building?.();
  const bundle =
    txHashes.length === 1
      ? fromSingle(chainKey, await builder.getProof(txHashes[0]!))
      : fromBatch(chainKey, await builder.getBatchProof(txHashes));

  progress.ready?.(bundle);
  return bundle;
}

function fromSingle(chainKey: ChainKey, result: proofProvider.ProofResult): EvidenceBundle {
  if (!result.success || !result.data) throw new ProofError(result.error ?? 'proof generation failed');
  const d = result.data;
  return {
    chainKey,
    rows: [
      {
        blockHeight: d.headerNumber,
        txIndex: d.txIndex,
        txHash: d.txHash,
        txBytes: d.txBytes,
        merkleRoot: d.merkleProof.root,
        siblings: d.merkleProof.siblings as ProofRow['siblings'],
      },
    ],
    continuity: d.continuityProof,
    continuityLength: d.continuityProof.roots.length,
    cached: d.cached,
  };
}

/**
 * Flatten `Map<blockHeight, Map<txIndex, entry>>` into parallel arrays.
 *
 * Map iteration order carries no guarantee, and `WatchtowerCore` enforces adjacency on the sorted
 * window, so the rows are sorted here too. The contract re-derives every index from the precompile
 * regardless - sorting is politeness toward an honest worker, not a security measure.
 */
function fromBatch(chainKey: ChainKey, result: proofProvider.BatchProofResult): EvidenceBundle {
  if (!result.success || !result.data) throw new ProofError(result.error ?? 'batch proof generation failed');
  const d = result.data;

  const rows: ProofRow[] = [];
  for (const [blockHeight, inner] of d.merkleProofs.entries()) {
    for (const [txIndex, entry] of inner.entries()) {
      rows.push({
        blockHeight: Number(blockHeight),
        txIndex: Number(txIndex),
        txHash: entry.txHash,
        txBytes: entry.txBytes,
        merkleRoot: entry.merkleProof.root,
        siblings: entry.merkleProof.siblings as ProofRow['siblings'],
      });
    }
  }
  rows.sort((a, b) => a.blockHeight - b.blockHeight || a.txIndex - b.txIndex);

  return {
    chainKey,
    rows,
    continuity: d.continuityProof,
    continuityLength: d.continuityProof.roots.length,
    cached: d.cached,
  };
}
