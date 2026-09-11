import type { Hex } from 'viem';
import { contracts, publicClient } from '../chain.js';
import { store } from '../db/store.js';

/** A source-chain position: the coordinate every stream rule orders its evidence by. */
export interface Coord {
  height: number;
  index: number;
}

/**
 * Where a stream subject has actually been proven up to.
 *
 * **Read from Creditcoin, never from the worker's own file.** The on-chain cursor is the only cursor
 * that decides anything: `WatchtowerCore` refuses any window that does not strictly advance it, so a
 * local guess that runs ahead does not make the worker fast, it makes it wrong - every transaction it
 * skipped past becomes a permanent hole in the ledger and, worse, a gap challenge waiting to happen
 * against its own submission.
 *
 * `stateOf` reports the subject's anchor before the first ingestion, so a fresh subject starts where
 * it was registered to start rather than at block zero.
 */
export async function provenCursor(subjectId: Hex): Promise<Coord> {
  const state = await publicClient.readContract({
    ...contracts.core,
    functionName: 'stateOf',
    args: [subjectId],
  });
  return { height: Number(state.cursorHeight), index: Number(state.cursorIndex) };
}

/** True when `(height, index)` sits strictly after `cursor` in source-chain order. */
export function isAfter(cursor: Coord, height: number, index: number): boolean {
  return height > cursor.height || (height === cursor.height && index > cursor.index);
}

const TERMINAL = ['CONFIRMED', 'UNPROVABLE'];

/**
 * Is something already on its way to the chain for this subject?
 *
 * A stream submission takes minutes - attestation alone is about eight - while the scanners tick
 * every twenty seconds. Without this the same window would be rebuilt and re-queued dozens of times
 * before the first attempt ever landed, and each duplicate costs a proof build and a pre-flight.
 */
export function hasWorkInFlight(subjectId: Hex): boolean {
  return store.candidates((c) => c.subjectId === subjectId && !TERMINAL.includes(c.state)).length > 0;
}
