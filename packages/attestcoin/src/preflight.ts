import type { AttestcoinClient } from './client.js';
import type { EvidenceBundle } from './proofs.js';

/**
 * Ask the precompile, read-only, whether this bundle would verify - before signing anything.
 *
 * This catches the two failures that actually happen in production: the attestation has not landed
 * yet, and the block was replaced by a sparse checkpoint mid-flight. It is purely economic. The ASC
 * verifies independently inside the settling transaction, and only that verification can move money.
 */
export async function preflight(client: AttestcoinClient, bundle: EvidenceBundle): Promise<boolean> {
  const merkleProofs = bundle.rows.map((r) => ({ root: r.merkleRoot, siblings: r.siblings }));
  try {
    if (bundle.rows.length === 1) {
      const row = bundle.rows[0]!;
      return await client.prover.verifySingle(
        bundle.chainKey,
        row.blockHeight,
        row.txBytes,
        merkleProofs[0]! as never,
        bundle.continuity as never,
      );
    }
    return await client.prover.verifyBatch(
      bundle.chainKey,
      bundle.rows.map((r) => r.blockHeight),
      bundle.rows.map((r) => r.txBytes),
      merkleProofs as never,
      bundle.continuity as never,
    );
  } catch {
    // A revert here means "not provable yet", not "the worker is broken".
    return false;
  }
}
