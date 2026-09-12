'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * `checking`     — the first request is still in flight. No verdict either way yet.
 * `booting`      — it has actually failed, but not for long enough to call it dead.
 * `catching-up`  — answering, scanners still sweeping towards the attested head.
 * `live`         — answering, cursors within tolerance of the head.
 * `down`         — unreachable past the grace period. Say so plainly.
 *
 * `checking` earns its place by being the state a *healthy* worker passes through. Folding it into
 * `booting` meant every visit to a working deployment opened on the warm-up panel for as long as one
 * request takes, and then celebrated the worker coming back from an outage that never happened.
 */
export type WorkerPhase = 'checking' | 'booting' | 'catching-up' | 'live' | 'down';

/**
 * Blocks behind that still reads as caught up.
 *
 * Deliberately not zero. `cursorLag` is measured against the *attested* head while the scanners sit
 * `SCAN_CONFIRMATIONS` behind the source head on purpose, so that evidence is finalised before it is
 * proven. A worker doing its job therefore never reports zero, and a threshold of zero would leave a
 * perfectly healthy deployment showing "catching up" forever.
 */
const LAG_TOLERANCE = 200;

/**
 * How long the worker may stay unreachable before we stop calling it "starting".
 *
 * A free-tier container cold-starts in roughly 30-60s: the boot checks in the worker's `main()` talk
 * to Creditcoin and to the precompile before the API binds, so health is silent for the whole of it.
 * Past ninety seconds the honest reading is that it is not waking up, and a loader that never
 * resolves is a worse experience than an error.
 */
const BOOT_GRACE_MS = 90_000;

/**
 * When the worker was first seen unreachable. Cleared the moment it answers.
 *
 * Module scope rather than a ref because this hook is mounted by the header, the warm-up panel, the
 * banner and several routes at once, and per-instance refs would give each of them a different idea
 * of when the outage began. Written inside `queryFn` rather than during render so it updates exactly
 * once per fetch, no matter how many components are watching.
 */
let downSince: number | null = null;

const maxLag = (lag: Record<string, number> | undefined): number => {
  const values = Object.values(lag ?? {});
  // An empty map means the worker could not read the registry, not that it is caught up. Reporting 0
  // is the right degradation: we cannot prove it is behind, so we do not hold the screen hostage.
  return values.length > 0 ? Math.max(...values) : 0;
};

/**
 * Is the prosecutor worker reachable, and if so, has it caught up?
 *
 * Shares the `['health']` query key with the header and the warm-up panel, so asking in several
 * places costs one request.
 *
 * This matters more than it looks: without the worker the incident feed is simply empty, which is
 * indistinguishable from "nothing has ever happened". Everything the chain knows still renders, so a
 * silent empty list is the wrong story to tell.
 */
export function useWorkerStatus() {
  const health = useQuery({
    queryKey: ['health'],
    retry: false,
    queryFn: async () => {
      try {
        const report = await api.health();
        downSince = null;
        return report;
      } catch (error) {
        downSince ??= Date.now();
        throw error;
      }
    },
    /**
     * Poll hard while something is happening, then get out of the way. Two seconds through a cold
     * start is the difference between the celebration landing on the moment the worker answers and
     * landing up to fifteen seconds after it.
     */
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) {
        const waiting = downSince !== null && Date.now() - downSince > BOOT_GRACE_MS;
        return waiting ? 15_000 : 2_000;
      }
      return maxLag(data.cursorLag) > LAG_TOLERANCE ? 3_000 : 15_000;
    },
  });

  const lag = maxLag(health.data?.cursorLag);

  let phase: WorkerPhase;
  if (health.isSuccess) {
    phase = lag > LAG_TOLERANCE ? 'catching-up' : 'live';
  } else if (downSince === null) {
    // Nothing has failed yet - this is the opening request, not an outage.
    phase = 'checking';
  } else if (Date.now() - downSince > BOOT_GRACE_MS) {
    phase = 'down';
  } else {
    phase = 'booting';
  }

  return {
    phase,
    lag,
    lagTolerance: LAG_TOLERANCE,
    health: health.data,
    /** Kept for the routes that only ask the yes/no question. */
    online: health.isSuccess,
    offline: health.isError,
    checking: health.isLoading,
  };
}
