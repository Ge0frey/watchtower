'use client';

import Link from 'next/link';
import { formatCtc, formatUsd } from '@watchtower/shared';
import { useChainState, deployed } from '@/hooks/useChainState';

/**
 * The landing page's one honest brag: numbers the reader's own browser just read off
 * Creditcoin.
 *
 * It is placed where a marketing page would normally put logos or testimonials, and
 * it does the same job better. Nothing here is authored — the proven height, the
 * proven price and the staked capital are all contract reads, so the section is
 * either live or visibly absent. It cannot be quietly wrong.
 *
 * Set on ink, because a magenta number on black is the most emphatic thing this
 * design system can say, and these are the only numbers that have earned it.
 */
export function LiveProof() {
  const { data: subjects = [], isLoading } = useChainState();

  if (!deployed) return null;

  const feed = subjects.find((s) => s.kind === 2);
  const head = subjects.reduce<bigint>((best, s) => (s.cursorHeight > best ? s.cursorHeight : best), 0n);
  const staked = subjects.reduce((sum, s) => sum + s.staked, 0n);
  const bounties = subjects.reduce((sum, s) => sum + s.bountyPool, 0n);

  const cells = [
    { label: 'Proven Ethereum height', value: head > 0n ? Number(head).toLocaleString() : '—', accent: true },
    { label: 'Proven ETH/USD', value: feed && feed.price > 0n ? formatUsd(feed.price) : '—', accent: true },
    { label: 'Subjects watched', value: isLoading ? '…' : String(subjects.length) },
    { label: 'Capital staked', value: formatCtc(staked, 2) },
    { label: 'Bounty pools', value: formatCtc(bounties, 2) },
  ];

  return (
    <section className="ruled-ink border-y border-ink bg-ink text-paper">
      <div className="shell py-20 md:py-24">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="label mb-5 text-paper/50">Live on Creditcoin CC3 Testnet</p>
            <h2 className="display text-[clamp(2rem,5vw,3.5rem)] text-paper">
              Not a mockup.
              <br />
              Your browser read this.
            </h2>
          </div>
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 border-b border-paper/30 pb-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-paper transition-colors hover:border-accent hover:text-accent"
          >
            Open the dashboard
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </Link>
        </div>

        <dl className="mt-14 grid grid-cols-2 gap-x-8 gap-y-10 border-t border-paper/15 pt-10 md:grid-cols-5">
          {cells.map((cell) => (
            <div key={cell.label}>
              <dt className="label mb-4 text-paper/50">{cell.label}</dt>
              <dd
                className={`font-mono text-[clamp(1.25rem,2.4vw,1.75rem)] leading-none tracking-tight ${
                  cell.accent ? 'text-accent' : 'text-paper'
                }`}
              >
                {cell.value}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-12 max-w-[74ch] text-[14px] leading-relaxed text-paper/45">
          Every figure above is a contract read against Creditcoin, made by the page you are looking
          at. The ETH/USD answer was not fetched from an API &mdash; it was proven from
          Chainlink&rsquo;s own Ethereum transaction through the block prover precompile, and stored
          on Creditcoin.
        </p>
      </div>
    </section>
  );
}
