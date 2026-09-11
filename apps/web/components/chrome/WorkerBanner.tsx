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
 */
export function WorkerBanner() {
  const { offline } = useWorkerStatus();
  if (!offline) return null;

  return (
    <div className="mb-10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-ink/12 bg-card px-4 py-3">
      <span className="label text-open">Worker offline</span>
      <span className="text-[13px] text-ink/55">
        Chain state and every wallet action still work. History and proof building do not &mdash;
        start it with{' '}
        <code className="rounded-sm border border-ink/15 bg-paper px-1.5 py-0.5 font-mono text-[12px] text-ink">
          pnpm worker
        </code>
        .
      </span>
    </div>
  );
}
