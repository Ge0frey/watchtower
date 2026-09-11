import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Candidate, CandidateState, Incident } from '@watchtower/shared';
import { config } from '../config.js';

/**
 * Durable worker state.
 *
 * The protocol's own guidance for readability workers is explicit about this: keep records of
 * in-flight events, catch up after an unexpected shutdown, and never submit the same event twice.
 * This store is the part that survives a restart - cursors are only advanced once an on-chain receipt
 * confirms, so a crash mid-pipeline replays rather than skips.
 *
 * Backed by an atomically-replaced JSON file. The schema below is the same shape as the Postgres
 * deployment path in `schema.sql`; swapping drivers does not change any caller.
 */
interface Snapshot {
  cursors: Record<string, { height: number; index: number }>;
  candidates: Record<string, Candidate>;
  incidents: Record<string, Incident>;
  prosecutors: Record<string, { submissions: number; bountiesWei: string }>;
  lastScanned: Record<string, number>;
}

const empty: Snapshot = {
  cursors: {},
  candidates: {},
  incidents: {},
  prosecutors: {},
  lastScanned: {},
};

export class Store {
  private snapshot: Snapshot;
  private readonly path: string;
  private writeQueued = false;

  constructor(dir = config.dataDir) {
    mkdirSync(dir, { recursive: true });
    this.path = resolve(dir, 'watchtower.json');
    this.snapshot = existsSync(this.path)
      ? { ...empty, ...(JSON.parse(readFileSync(this.path, 'utf8')) as Snapshot) }
      : { ...empty };
  }

  // ------------------------------------------------------------------ cursors

  cursor(subjectId: string): { height: number; index: number } | undefined {
    return this.snapshot.cursors[subjectId];
  }

  /** Only ever called after a confirmed receipt - never optimistically. */
  setCursor(subjectId: string, height: number, index: number) {
    this.snapshot.cursors[subjectId] = { height, index };
    this.flush();
  }

  lastScanned(key: string): number | undefined {
    return this.snapshot.lastScanned[key];
  }

  setLastScanned(key: string, height: number) {
    this.snapshot.lastScanned[key] = height;
    this.flush();
  }

  // --------------------------------------------------------------- candidates

  upsertCandidate(candidate: Candidate) {
    this.snapshot.candidates[candidate.id] = candidate;
    this.flush();
  }

  candidate(id: string): Candidate | undefined {
    return this.snapshot.candidates[id];
  }

  setCandidateState(id: string, state: CandidateState, lastError?: string) {
    const existing = this.snapshot.candidates[id];
    if (!existing) return;
    existing.state = state;
    if (lastError) existing.lastError = lastError;
    if (state === 'FAILED' || state === 'PROVING') existing.attempts += 1;
    this.flush();
  }

  candidates(filter?: (c: Candidate) => boolean): Candidate[] {
    const all = Object.values(this.snapshot.candidates);
    return (filter ? all.filter(filter) : all).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Anything not in a terminal state is replayed on boot. */
  resumable(): Candidate[] {
    return this.candidates(
      (c) => !['CONFIRMED', 'UNPROVABLE'].includes(c.state) && c.attempts < config.maxAttempts,
    );
  }

  /** Local duplicate suppression. The on-chain replay guard is the real defence; this saves gas. */
  hasCandidateFor(txHashes: string[]): boolean {
    const key = txHashes.join('|').toLowerCase();
    return Object.values(this.snapshot.candidates).some(
      (c) => c.txHashes.join('|').toLowerCase() === key,
    );
  }

  // ---------------------------------------------------------------- incidents

  upsertIncident(incident: Incident) {
    const existing = this.snapshot.incidents[incident.id];
    this.snapshot.incidents[incident.id] = existing ? { ...existing, ...incident } : incident;
    this.flush();
  }

  incident(id: string): Incident | undefined {
    return this.snapshot.incidents[id];
  }

  incidents(limit = 50): Incident[] {
    return Object.values(this.snapshot.incidents)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  // -------------------------------------------------------------- prosecutors

  creditProsecutor(address: string, bountyWei: bigint) {
    const key = address.toLowerCase();
    const row = this.snapshot.prosecutors[key] ?? { submissions: 0, bountiesWei: '0' };
    row.submissions += 1;
    row.bountiesWei = (BigInt(row.bountiesWei) + bountyWei).toString();
    this.snapshot.prosecutors[key] = row;
    this.flush();
  }

  leaderboard() {
    return Object.entries(this.snapshot.prosecutors)
      .map(([address, row]) => ({ address, ...row }))
      .sort((a, b) => (BigInt(b.bountiesWei) > BigInt(a.bountiesWei) ? 1 : -1));
  }

  // -------------------------------------------------------------------- write

  private flush() {
    if (this.writeQueued) return;
    this.writeQueued = true;
    setImmediate(() => {
      this.writeQueued = false;
      const tmp = `${this.path}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.snapshot, null, 2));
      renameSync(tmp, this.path); // atomic replace: a crash mid-write cannot corrupt the store
    });
  }
}

export const store = new Store();
