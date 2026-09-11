'use client';

import { useWorkerStatus } from '@/hooks/useWorkerStatus';

/**
 * Say plainly what is and is not available when the worker is down.
 *
 * The split is deliberate and worth understanding: everything that decides money is read from
 * Creditcoin directly, so cover, staking and bounties keep working with the worker stopped. What the
 * worker holds is history and the ability to build proofs - neither of which the chain serves.
 */
export function WorkerBanner() {
  const { offline } = useWorkerStatus();
  if (!offline) return null;

  return (
    <div className="worker-banner">
      <strong>Prosecutor worker offline.</strong> Chain state below is live and every wallet action
      still works &mdash; cover, staking, bounties. What needs the worker: incident history, the
      leaderboard, and building proofs (so prosecuting and challenging are unavailable). Start it with{' '}
      <code>pnpm worker</code>.
    </div>
  );
}
