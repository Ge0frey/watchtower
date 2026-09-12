'use client';

import { useWorkerStatus } from '@/hooks/useWorkerStatus';

/**
 * One line, because the worker being down is not an emergency.
 *
 * The split is worth understanding and is why this stays small: everything that
 * decides money is read from Creditcoin directly, so cover, staking and bounties keep
 * working with the worker stopped. What the worker holds is history and the ability
 * to build proofs. A full paragraph in a tinted box at the top of every route made a
 * working application look broken.
 *
 * Only the `down` phase renders here. A worker that is merely starting or still sweeping up to the
 * head is narrated by `WorkerWarmup` instead — calling a cold start an outage would be the same
 * mistake in the other direction.
 */
export function WorkerBanner() {
  const { phase } = useWorkerStatus();
  if (phase !== 'down') return null;

  return (
    <div className="mb-10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-ink/12 bg-card px-4 py-3">
      <span className="label text-open">Worker offline</span>
      <span className="text-[13px] text-ink/55">
        Chain state and every wallet action still work. History and proof building do not &mdash; the
        prosecutor is not answering, and anyone can run one.
      </span>
    </div>
  );
}
