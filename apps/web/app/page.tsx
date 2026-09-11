'use client';

import Link from 'next/link';
import { formatCtc, formatUsd } from '@watchtower/shared';
import { IncidentCard } from '@/components/IncidentCard';
import { deployed, useChainState } from '@/hooks/useChainState';
import { useIncidentFeed } from '@/hooks/useIncidentFeed';
import { useWorkerStatus } from '@/hooks/useWorkerStatus';

/**
 * The overview: what this is, and proof that it is running.
 *
 * Renders completely without a wallet, on purpose. Someone seeing Watchtower for the first time
 * should understand it before being asked to connect anything.
 */
export default function Overview() {
  const { data: subjects = [], isLoading } = useChainState();
  const { incidents } = useIncidentFeed();
  const { offline } = useWorkerStatus();

  const staked = subjects.reduce((sum, s) => sum + s.staked, 0n);
  const paidOut = subjects.reduce((sum, s) => sum + s.paidOut, 0n);
  const bounties = subjects.reduce((sum, s) => sum + s.bountyPool, 0n);
  const settled = incidents.filter((i) => i.status === 'settled').length;

  return (
    <>
      <section className="hero">
        <h1>Proof-native insurance for Ethereum, underwritten on Creditcoin.</h1>
        <p className="hero-lede">
          An Ethereum contract cannot see the transactions beside it in its own block, and cannot
          audit a custodian&rsquo;s whole history in a single call. A Creditcoin contract can do both.
          Watchtower turns that into cover that pays out on proof alone &mdash; no claims adjuster, no
          oracle operator, no trusted watcher.
        </p>
        <div className="hero-actions">
          <Link className="btn" href="/subjects">Browse risks</Link>
          <Link className="btn btn-ghost" href="/incidents">See verdicts</Link>
        </div>
      </section>

      {!deployed && (
        <div className="notice">
          No deployment configured. Set <code>NEXT_PUBLIC_WATCHTOWER_CORE</code>,{' '}
          <code>NEXT_PUBLIC_SUBJECT_REGISTRY</code> and <code>NEXT_PUBLIC_UNDERWRITING_VAULT</code>.
        </div>
      )}

      <section className="stat-row">
        <Stat label="subjects watched" value={isLoading ? '…' : String(subjects.length)} />
        <Stat label="capital staked" value={formatCtc(staked, 2)} />
        <Stat label="bounty pools" value={formatCtc(bounties, 2)} />
        <Stat label="restitution paid" value={formatCtc(paidOut, 2)} />
        <Stat label="verdicts settled" value={String(settled)} />
      </section>

      <section className="how">
        <Step n={1} title="Someone buys cover">
          A trader on a pool, or a holder of a bridge&rsquo;s wrapped assets, takes out cover priced at
          1% per 30 days.
        </Step>
        <Step n={2} title="Something provable happens">
          A searcher brackets their swap inside one Ethereum block, or a custodian mints more than it
          locked.
        </Step>
        <Step n={3} title="A stranger proves it">
          Anyone running the open-source worker builds a Merkle and continuity proof and submits it
          for the bounty.
        </Step>
        <Step n={4} title="The precompile decides">
          Creditcoin verifies the proof natively, the rule prices the damage at a proven Chainlink
          price, and the vault pays. The claim <em>is</em> the proof.
        </Step>
      </section>

      <section>
        <div className="section-head">
          <span className="section-label">latest verdicts</span>
          <Link className="dim small" href="/incidents">all incidents →</Link>
        </div>
        {incidents.slice(0, 3).map((incident) => (
          <IncidentCard key={incident.id} incident={incident} />
        ))}
        {incidents.length === 0 && (
          <div className="empty">
            <p>{offline ? 'Verdict history unavailable.' : 'No incidents yet.'}</p>
            <p className="dim small">
              {offline
                ? 'The prosecutor worker is not reachable. Everything above is read from Creditcoin and is current.'
                : 'The prosecutor is watching a Uniswap pool on Ethereum mainnet and a bridge on Sepolia.'}
            </p>
          </div>
        )}
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="step">
      <span className="step-n">{n}</span>
      <div>
        <span className="step-title">{title}</span>
        <p className="dim small">{children}</p>
      </div>
    </div>
  );
}
