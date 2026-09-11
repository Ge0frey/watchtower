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

/**
 * `JSON.stringify` throws outright on a BigInt - "Do not know how to serialize a BigInt" - and
 * incidents carry two of them (`damagesUsd` and `paid`, both read straight off a chain event). An
 * unhandled throw inside the flush kills the whole worker process, moments after a verdict has
 * already settled on-chain: the money moves, the prosecutor dies, and the dashboard's feed stops.
 *
 * So bigints are tagged on the way out and rebuilt on the way in. Tagging rather than stringifying
 * keeps the types honest across a restart - a resumed incident still holds bigints, not strings that
 * would silently fail every arithmetic comparison downstream.
 */
interface TaggedBigInt {
  $bigint: string;
}

const isTagged = (value: unknown): value is TaggedBigInt =>
  typeof value === 'object' && value !== null && typeof (value as TaggedBigInt).$bigint === 'string';

function replacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? ({ $bigint: value.toString() } satisfies TaggedBigInt) : value;
}

function reviver(_key: string, value: unknown): unknown {
  return isTagged(value) ? BigInt(value.$bigint) : value;
}

export class Store {
  private snapshot: Snapshot;
  private readonly path: string;
  private writeQueued = false;

  constructor(dir = config.dataDir) {
    mkdirSync(dir, { recursive: true });
    this.path = resolve(dir, 'watchtower.json');
    this.snapshot = existsSync(this.path) ? this.load() : { ...empty };
  }

  /**
   * A corrupt or half-written store must not stop the worker from starting.
   *
   * Everything in here is a cache: cursors are re-read from the chain, in-flight candidates are
   * re-detected by the scanners, and incidents are re-indexed from Creditcoin's own events. Starting
   * empty costs a little history; refusing to start costs the demo.
   */
  private load(): Snapshot {
    try {
      return { ...empty, ...(JSON.parse(readFileSync(this.path, 'utf8'), reviver) as Snapshot) };
    } catch (error) {
      console.warn(
        `[store] ${this.path} is unreadable (${error instanceof Error ? error.message : error}); starting empty`,
      );
      return { ...empty };
    }
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
      try {
        const tmp = `${this.path}.tmp`;
        writeFileSync(tmp, JSON.stringify(this.snapshot, replacer, 2), 'utf8');
        renameSync(tmp, this.path); // atomic replace: a crash mid-write cannot corrupt the store
      } catch (error) {
        // A flush runs on `setImmediate`, outside any caller's try/catch, so anything thrown here is
        // an unhandled exception that takes the process down - after the verdict it was recording
        // has already settled on-chain. Bookkeeping never gets to kill the prosecutor.
        console.error('[store] flush failed:', error instanceof Error ? error.message : error);
      }
    });
  }
}

export const store = new Store();
