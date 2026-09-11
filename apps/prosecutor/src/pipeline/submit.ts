import { parseEventLogs, type Address, type Hex, type Log } from 'viem';
import {
  buildEvidenceBundle,
  coordsOf,
  createClient,
  gasAsPercentageOfMax,
  gasLimitFor,
  preflight,
  toEvidenceInput,
  type EvidenceBundle,
} from '@watchtower/attestcoin';
import { watchtowerCoreAbi, type Candidate, type ChainKey } from '@watchtower/shared';
import { bus } from '../bus.js';
import { config } from '../config.js';
import { coreContract, ethersProvider, prosecutorWallet } from '../chain.js';
import { store } from '../db/store.js';

const client = createClient();

export interface SubmitResult {
  txHash: Hex;
  gasUsed: bigint;
  gasPercentOfBlock: number;
  bundle: EvidenceBundle;
}

/**
 * The whole readability round trip for one candidate.
 *
 * detect -> wait for attestation -> build proofs -> pre-flight -> submit -> confirm.
 *
 * Nothing here can forge a verdict. The worker only assembles proofs and pays gas; the Attestcoin
 * Smart Contract verifies everything again inside the settling transaction, so a dishonest worker
 * gets a revert rather than a payout.
 */
export async function prosecute(candidate: Candidate, valueWei = 0n): Promise<SubmitResult> {
  store.setCandidateState(candidate.id, 'AWAITING_ATTESTATION');

  const bundle = await buildEvidenceBundle(client, candidate.chainKey as ChainKey, candidate.txHashes, {
    waiting: (blockHeight, attestedHeight) =>
      bus.publish({ type: 'proof.waiting', candidateId: candidate.id, blockHeight, attestedHeight }),
    building: () => {
      store.setCandidateState(candidate.id, 'PROVING');
      bus.publish({ type: 'proof.building', candidateId: candidate.id });
    },
    ready: (b) =>
      bus.publish({
        type: 'proof.ready',
        candidateId: candidate.id,
        continuityLength: b.continuityLength,
        cached: b.cached,
      }),
  });

  // Read-only precompile check before signing anything. Purely economic: it catches "not attested
  // yet" and "the block was replaced by a checkpoint mid-flight" without burning gas.
  store.setCandidateState(candidate.id, 'PREFLIGHT');
  if (!(await preflight(client, bundle))) {
    store.setCandidateState(candidate.id, 'FAILED', 'pre-flight verification returned false');
    throw new Error('pre-flight verification failed - evidence is not provable yet');
  }

  if (!config.submitEnabled) throw new Error('submission disabled (SUBMIT_ENABLED=false)');

  const input = toEvidenceInput(bundle, candidate.subjectId, candidate.ruleId);
  const wallet = prosecutorWallet();
  const core = coreContract(wallet);

  const submitEvidence = core.getFunction('submitEvidence');
  const calldata = core.interface.encodeFunctionData('submitEvidence', [input]);
  const from = await wallet.getAddress();
  const gasLimit = await gasLimitFor(ethersProvider, core, calldata, from, bundle.continuityLength);

  const tx = await submitEvidence(input, { value: valueWei, gasLimit });
  store.setCandidateState(candidate.id, 'SUBMITTED');
  bus.publish({ type: 'evidence.submitted', candidateId: candidate.id, txHash: tx.hash as Hex });

  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    store.setCandidateState(candidate.id, 'FAILED', 'transaction reverted on Creditcoin');
    throw new Error(`submission reverted: ${tx.hash}`);
  }

  store.setCandidateState(candidate.id, 'CONFIRMED');
  recordIncident(candidate, bundle, receipt.logs as unknown as Log[], tx.hash as Hex, from as Address);

  return {
    txHash: tx.hash as Hex,
    gasUsed: receipt.gasUsed,
    gasPercentOfBlock: gasAsPercentageOfMax(receipt.gasUsed),
    bundle,
  };
}

/**
 * Write down what the worker knows and the chain does not repeat.
 *
 * `VerdictIssued` carries the judgement - beneficiary, damages, payout - but not the evidence it was
 * judged from, because storing coordinates on-chain would cost gas for something already provable.
 * The worker is the only party holding both halves, so it records its half here: the exact
 * `(blockHeight, txIndex)` coordinates, who submitted, and how long the continuity proof was.
 *
 * Without this the incident arrives at the dashboard with an empty `evidence` array, and the block
 * strip - the whole point of the visual - renders nothing at all.
 *
 * `incidentId` is recovered from the `EvidenceAccepted` event rather than the function's return
 * value, which a receipt does not carry.
 */
function recordIncident(
  candidate: Candidate,
  bundle: EvidenceBundle,
  logs: Log[],
  txHash: Hex,
  prosecutor: Address,
) {
  try {
    const accepted = parseEventLogs({ abi: watchtowerCoreAbi, eventName: 'EvidenceAccepted', logs });
    const incidentId = accepted[0]?.args?.incidentId as Hex | undefined;
    if (!incidentId) return;

    const existing = store.incident(incidentId);
    store.upsertIncident({
      id: incidentId,
      subjectId: candidate.subjectId,
      ruleId: candidate.ruleId,
      prosecutor,
      beneficiary: existing?.beneficiary ?? ('0x0000000000000000000000000000000000000000' as Address),
      damagesUsd: existing?.damagesUsd ?? 0n,
      paid: existing?.paid ?? 0n,
      status: existing?.status ?? 'none',
      challengeDeadline: existing?.challengeDeadline ?? 0,
      continuityLength: bundle.continuityLength,
      evidence: coordsOf(bundle, candidate.chainKey as ChainKey),
      creditcoinTxHash: txHash,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
  } catch (error) {
    // Never fail a settled submission over bookkeeping - the verdict is already on-chain.
    console.warn('[submit] could not record incident evidence:', error instanceof Error ? error.message : error);
  }
}

/** Exponential backoff with jitter, so a proof-builder wobble does not become a stampede. */
export function backoffMs(attempts: number): number {
  const base = config.backoffBaseMs * 2 ** Math.min(attempts, 5);
  return base + Math.floor(Math.random() * config.backoffBaseMs);
}
