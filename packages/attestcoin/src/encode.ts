import type { Hex } from 'viem';
import type { ChainKey } from '@watchtower/shared';
import type { EvidenceBundle } from './proofs.js';

/** Exactly the `EvidenceInput` struct WatchtowerCore.submitEvidence expects. */
export interface EvidenceInputArgs {
  subjectId: Hex;
  ruleId: Hex;
  chainKey: bigint;
  blockHeights: bigint[];
  encodedTxs: Hex[];
  merkleRoots: Hex[];
  siblings: { hash: Hex; isLeft: boolean }[][];
  lowerEndpointDigest: Hex;
  continuityRoots: Hex[];
}

/**
 * The only place in the codebase that knows both the SDK's proof shape and the contract's ABI.
 *
 * Note what is NOT here: transaction indices. The contract derives each one from the precompile's
 * `calculateTxIndex`, so a worker cannot assert a position it did not prove.
 */
export function toEvidenceInput(
  bundle: EvidenceBundle,
  subjectId: Hex,
  ruleId: Hex,
): EvidenceInputArgs {
  return {
    subjectId,
    ruleId,
    chainKey: BigInt(bundle.chainKey),
    blockHeights: bundle.rows.map((r) => BigInt(r.blockHeight)),
    encodedTxs: bundle.rows.map((r) => r.txBytes as Hex),
    merkleRoots: bundle.rows.map((r) => r.merkleRoot as Hex),
    siblings: bundle.rows.map((r) => r.siblings.map((s) => ({ hash: s.hash as Hex, isLeft: s.isLeft }))),
    lowerEndpointDigest: bundle.continuity.lowerEndpointDigest as Hex,
    continuityRoots: bundle.continuity.roots as Hex[],
  };
}

/** viem's `writeContract` takes struct args positionally as a tuple object. */
export function asContractArg(input: EvidenceInputArgs) {
  return {
    subjectId: input.subjectId,
    ruleId: input.ruleId,
    chainKey: input.chainKey,
    blockHeights: input.blockHeights,
    encodedTxs: input.encodedTxs,
    merkleRoots: input.merkleRoots,
    siblings: input.siblings,
    lowerEndpointDigest: input.lowerEndpointDigest,
    continuityRoots: input.continuityRoots,
  } as const;
}

/**
 * The coordinates a verdict was judged from, carried alongside it so the dashboard can link each
 * piece of evidence back to the transaction on Ethereum.
 */
export function coordsOf(bundle: EvidenceBundle, chainKey: ChainKey) {
  return bundle.rows.map((r) => ({
    chainKey,
    blockHeight: r.blockHeight,
    txIndex: r.txIndex,
    txHash: r.txHash as Hex,
  }));
}
