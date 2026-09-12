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

/**
 * The lag of each subject at the previous sample, and whether it improved between the two.
 *
 * Being behind is not the same as catching up, and `cursorLag` cannot tell them apart on its own: it
 * measures the *proven on-chain cursor* against the attested head, and a stream subject's cursor only
 * moves when a submission settles. A custodian nobody has transacted with therefore drifts further
 * behind every block while its scanner is working perfectly and has simply found nothing to prove.
 *
 * Treating that as "catching up" leaves the warm-up panel running forever on a healthy deployment -
 * observed on the live worker, where DemoBridge climbed 10,439 -> 10,449 while Chainlink fell
 * 6,082 -> 77. So a subject counts as catching up only while its number is going *down*.
 *
 * Both live at module scope and are written inside `queryFn`, once per fetch, for the same reason
 * `downSince` is: several components mount this hook against one shared query.
 */
let previousLag: Record<string, number> = {};
let improving: Record<string, boolean> = {};

/**
 * Whether the worker was ever unreachable this session - which is what separates a genuine cold
 * start from an ordinary page load against a worker that never went away.
 *
 * It decides the first lag sample, where there is no previous value to compare against. After a real
 * outage the scanners are certainly sweeping, so assume so and show the catch-up. On a warm load,
 * assume nothing: a subject that is merely far behind is the steady state here, and treating it as
 * catch-up would put the panel and its celebration on every single visit.
 */
let sawOutage = false;

function sampleLag(current: Record<string, number> | undefined) {
  const lag = current ?? {};
  const next: Record<string, boolean> = {};
  for (const [label, value] of Object.entries(lag)) {
    const prev = previousLag[label];
    next[label] = prev === undefined ? sawOutage : value < prev;
  }
  improving = next;
  previousLag = lag;
}

/** How far behind the subjects that are actually sweeping are. Zero when none of them is. */
const sweepingLag = (lag: Record<string, number> | undefined): number => {
  const behind = Object.entries(lag ?? {}).filter(
    ([label, value]) => value > LAG_TOLERANCE && improving[label],
  );
  return behind.length > 0 ? Math.max(...behind.map(([, value]) => value)) : 0;
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
        sampleLag(report.cursorLag);
        return report;
      } catch (error) {
        downSince ??= Date.now();
        sawOutage = true;
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
      return sweepingLag(data.cursorLag) > 0 ? 3_000 : 15_000;
    },
  });

  const lag = sweepingLag(health.data?.cursorLag);

  let phase: WorkerPhase;
  if (health.isSuccess) {
    phase = lag > 0 ? 'catching-up' : 'live';
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
