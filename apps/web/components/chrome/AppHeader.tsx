'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatUsd, shortHash } from '@watchtower/shared';
import { api } from '@/lib/api';
import { useChainState } from '@/hooks/useChainState';
import { ConnectButton } from './ConnectButton';

/**
 * Five destinations, in the order a person meets them, each with the one word that
 * says why they would go there. The descriptor is not decoration — it is the fix for
 * a navigation bar of nouns that mean nothing until you have already used the app.
 */
const NAV = [
  { href: '/dashboard', label: 'Dashboard', hint: 'what is happening' },
  { href: '/subjects', label: 'Subjects', hint: 'what is watched' },
  { href: '/incidents', label: 'Incidents', hint: 'what was judged' },
  { href: '/vault', label: 'Vault', hint: 'what backs it' },
  { href: '/prosecute', label: 'Prosecute', hint: 'file evidence' },
];

/**
 * The application's chrome: a paper header over an ink rail.
 *
 * The header is navigation and nothing else, set at full ink so it is legible at a
 * glance rather than tastefully faded into the paper. The rail underneath carries the
 * three ambient readings — proven head, proven price, prosecutor balance — as
 * marginalia. Nothing in here blinks: the rail proves the system is live by changing
 * its numbers.
 */
export function AppHeader() {
  const pathname = usePathname();
  const { data: subjects = [] } = useChainState();
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 15_000, retry: false });

  const feed = subjects.find((s) => s.kind === 2);
  const head = subjects.reduce<{ h: bigint; i: number } | null>(
    (best, s) => (s.cursorHeight > (best?.h ?? 0n) ? { h: s.cursorHeight, i: s.cursorIndex } : best),
    null,
  );

  const balance = health.data ? Number(health.data.prosecutorBalanceCtc) : null;

  return (
    <header className="sticky top-0 z-50">
      {/* ------------------------------------------------------ navigation */}
      <div className="border-b border-ink/12 bg-paper/92 backdrop-blur-md">
        <div className="shell flex h-20 items-center justify-between gap-8">
          <Link
            href="/"
            className="font-mono text-[13px] font-bold uppercase tracking-[0.24em] transition-colors hover:text-accent-deep"
            title="back to the argument"
          >
            Watchtower
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.hint}
                  className={`relative rounded-md px-4 py-2 text-[15px] transition-colors ${
                    active ? 'font-semibold text-ink' : 'font-medium text-ink/75 hover:bg-card hover:text-ink'
                  }`}
                >
                  {item.label}
                  {active && <span className="absolute inset-x-4 -bottom-[9px] h-[3px] bg-accent" />}
                </Link>
              );
            })}
          </nav>

          <ConnectButton />
        </div>
      </div>

      {/* ------------------------------- ambient state, as printed marginalia */}
      <div className="border-b border-ink bg-ink text-paper">
        <div className="shell flex h-9 items-center gap-7 overflow-x-auto">
          <Ambient
            label="Proven head"
            value={head && head.h > 0n ? `${Number(head.h).toLocaleString()} · ${head.i}` : '—'}
            title="the exact (block, index) this system has verified up to"
            accent
          />
          <Ambient
            label="ETH/USD"
            value={feed && feed.price > 0n ? formatUsd(feed.price) : '—'}
            title="proven from Chainlink's own AnswerUpdated transaction, not reported by us"
          />
          <Ambient
            label="Prosecutor"
            value={balance !== null ? `${balance.toFixed(2)} CTC` : health.isError ? 'offline' : '…'}
            title={health.data ? shortHash(health.data.prosecutorAddress) : 'worker API unreachable'}
            tone={health.isError ? 'breach' : undefined}
            className="hidden sm:flex"
          />
          <span className="ml-auto hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-paper/45 md:block">
            Creditcoin CC3 · 102031
          </span>
        </div>
      </div>

      {/* -------------------------------------------- navigation, small screens */}
      <nav className="border-b border-ink/12 bg-paper/92 backdrop-blur-md lg:hidden">
        <div className="shell flex items-center gap-6 overflow-x-auto">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`-mb-px shrink-0 whitespace-nowrap border-b-[3px] py-3.5 text-[14px] transition-colors ${
                  active ? 'border-accent font-semibold text-ink' : 'border-transparent font-medium text-ink/70'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

/** One ambient reading on the ink rail. */
function Ambient({
  label,
  value,
  title,
  accent,
  tone,
  className = '',
}: {
  label: string;
  value: string;
  title: string;
  accent?: boolean;
  tone?: 'breach';
  className?: string;
}) {
  return (
    <span title={title} className={`flex shrink-0 items-baseline gap-2.5 ${className}`}>
      <span className="label text-paper/50">{label}</span>
      <span
        className={`font-mono text-[11.5px] ${
          tone === 'breach' ? 'text-breach-lit' : accent ? 'text-accent' : 'text-paper/85'
        }`}
      >
        {value}
      </span>
    </span>
  );
}
