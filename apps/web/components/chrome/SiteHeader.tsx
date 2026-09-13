'use client';

import Link from 'next/link';
import { formatUsd } from '@watchtower/shared';
import { useChainState } from '@/hooks/useChainState';
import { Lockup } from '@/components/brand/Logo';

/**
 * The landing page's header.
 *
 * It carries two live numbers and no navigation weight, because the point of the
 * first screen is the argument, not the menu. Those two numbers do the arguing: a
 * proven Ethereum height and a proven ETH/USD answer, both read off Creditcoin by
 * this browser, ticking before anything has been explained. A marketing page that is
 * quietly telling the truth in the corner is worth more than a paragraph claiming it
 * does.
 */
export function SiteHeader() {
  const { data: subjects = [] } = useChainState();

  const feed = subjects.find((s) => s.kind === 2);
  const head = subjects.reduce<bigint>((best, s) => (s.cursorHeight > best ? s.cursorHeight : best), 0n);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-ink/12 bg-paper/85 backdrop-blur-xl">
      <div className="shell flex h-[72px] items-center justify-between gap-6">
        <Link href="/" className="transition-colors hover:text-accent-deep">
          <Lockup />
        </Link>

        <div className="flex items-center gap-5">
          {head > 0n && (
            <span
              title="the exact Ethereum height this system has verified up to, read from Creditcoin by your browser"
              className="hidden items-baseline gap-2.5 md:flex"
            >
              <span className="label text-ink/50">Proven height</span>
              <span className="font-mono text-[12px] text-accent-deep">
                {Number(head).toLocaleString()}
              </span>
            </span>
          )}
          {feed && feed.price > 0n && (
            <span className="hidden items-baseline gap-2.5 lg:flex">
              <span className="label text-ink/50">ETH/USD</span>
              <span className="font-mono text-[12px]">{formatUsd(feed.price)}</span>
            </span>
          )}
          <Link
            href="/dashboard"
            className="rounded-md border border-accent bg-accent px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink transition-colors hover:border-accent-deep hover:bg-accent-deep hover:text-paper"
          >
            Open app
          </Link>
        </div>
      </div>
    </header>
  );
}
