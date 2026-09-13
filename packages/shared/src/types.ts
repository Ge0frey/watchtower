import type { Address, Hex } from 'viem';
import type { ChainKey } from './chains';

/**
 * The coordinate the entire system turns on.
 *
 * `txIndex` is the transaction's position inside its Ethereum block. On Creditcoin it comes from the
 * Block Prover Precompile's own `calculateTxIndex`; off-chain the proof builder returns it directly.
 * An Ethereum contract cannot observe it for any transaction but its own - which is precisely why
 * Watchtower's claims can only be settled here.
 */
export interface EvidenceCoord {
  chainKey: ChainKey;
  blockHeight: number;
  txIndex: number;
  /** The source-chain transaction, so a verdict can link back to the evidence it was judged from. */
  txHash?: Hex;
}

export interface VerifiedTxView extends EvidenceCoord {
  txHash: Hex;
  from: Address;
  to: Address;
  success: boolean;
}

/** Mirrors `SubjectView` in Types.sol. Amounts are wei; `price` is USD with 8 decimals. */
export interface SubjectState {
  locked: bigint;
  minted: bigint;
  price: bigint;
  cursorHeight: number;
  cursorIndex: number;
}

export interface Subject {
  id: Hex;
  kind: number;
  chainKey: ChainKey;
  sourceContract: Address;
  boundRule: Hex;
  anchorHeight: number;
  anchorIndex: number;
  payoutCapPerBlock: bigint;
  priceSubject: Hex;
  active: boolean;
  label: string;
}

export type IncidentStatus = 'none' | 'open' | 'settled' | 'rolled-back';

export interface Incident {
  id: Hex;
  subjectId: Hex;
  ruleId: Hex;
  prosecutor: Address;
  beneficiary: Address;
  /** USD with 8 decimals, as judged by the rule. */
  damagesUsd: bigint;
  /** CTC wei actually transferred; may be less than damages once cover and caps apply. */
  paid: bigint;
  status: IncidentStatus;
  challengeDeadline: number;
  continuityLength: number;
  evidence: EvidenceCoord[];
  creditcoinTxHash?: Hex;
  createdAt: string;
}

/** Candidate lifecycle in the prosecutor worker. */
export type CandidateState =
  | 'DETECTED'
  | 'AWAITING_ATTESTATION'
  | 'PROVING'
  | 'PREFLIGHT'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'FAILED'
  | 'UNPROVABLE';

export interface Candidate {
  id: string;
  subjectId: Hex;
  ruleId: Hex;
  chainKey: ChainKey;
  txHashes: Hex[];
  blockHeight: number;
  state: CandidateState;
  attempts: number;
  lastError?: string;
  createdAt: string;
}

/** Server-sent events the dashboard listens to. */
export type StreamEvent =
  | { type: 'candidate.found'; candidate: Candidate }
  | { type: 'proof.waiting'; candidateId: string; blockHeight: number; attestedHeight: number }
  | { type: 'proof.building'; candidateId: string }
  | { type: 'proof.ready'; candidateId: string; continuityLength: number; cached: boolean }
  | { type: 'evidence.submitted'; candidateId: string; txHash: Hex }
  | { type: 'verdict.issued'; incident: Incident }
  | { type: 'breach.opened'; incident: Incident }
  | { type: 'challenge.upheld'; incidentId: Hex; challenger: Address }
  | { type: 'cursor.advanced'; subjectId: Hex; height: number; index: number }
  | { type: 'price.updated'; subjectId: Hex; answer: string; provenAtHeight: number }
  /**
   * Every candidate state change, from the one place they are all written.
   *
   * The narrated events above cover the happy path; this covers the rest of it. A retryable failure
   * used to change the worker's record and publish nothing, so a dashboard sat on the last string it
   * had been given - "verifying on Creditcoin" - while the candidate quietly cycled through failures
   * behind it, and only a refresh told the truth.
   */
  | {
      type: 'candidate.state';
      candidateId: string;
      state: CandidateState;
      attempts: number;
      message?: string;
      /** Set when the queue has scheduled another attempt, so the UI can say when. */
      retryInMs?: number;
    }
  | { type: 'error'; candidateId?: string; message: string };

export interface HealthReport {
  prosecutorAddress: Address;
  prosecutorBalanceCtc: string;
  attestedHeads: Record<number, number>;
  cursorLag: Record<string, number>;
  rpcStatus: Record<string, 'ok' | 'down'>;
  sseClients: number;
  chainId: number;
  ok: boolean;
}
