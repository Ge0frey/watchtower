'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatUsd, shortHash } from '@watchtower/shared';
import { api } from '@/lib/api';
import { useChainState } from '@/hooks/useChainState';
import { ConnectButton } from './ConnectButton';

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/subjects', label: 'Subjects' },
  { href: '/incidents', label: 'Incidents' },
  { href: '/vault', label: 'Vault' },
  { href: '/prosecute', label: 'Prosecute' },
];

/**
 * Ambient state, on every route.
 *
 * The proven head and the proven price are the smallest parts of the system and the ones that make
 * it look alive the moment a page opens. Keeping them in the chrome means navigation never costs
 * that - you are always looking at something that is visibly moving.
 */
export function AmbientHeader() {
  const pathname = usePathname();
  const { data: subjects = [] } = useChainState();
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 15_000, retry: false });

  const feed = subjects.find((s) => s.kind === 2);
  const head = subjects.reduce<{ h: bigint; i: number } | null>(
    (best, s) => (s.cursorHeight > (best?.h ?? 0n) ? { h: s.cursorHeight, i: s.cursorIndex } : best),
    null,
  );

  return (
    <header className="topbar">
      <div className="topbar-left">
        <Link href="/" className="brand">
          <span className="brand-mark">WATCHTOWER</span>
        </Link>
        <nav className="nav">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`nav-link ${active ? 'active' : ''}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="topbar-stats">
        <Badge
          label="proven head"
          value={head ? `${Number(head.h).toLocaleString()} · ${head.i}` : '—'}
          title="the exact (block, index) this system has verified up to"
        />
        <Badge
          label="ETH/USD"
          value={feed && feed.price > 0n ? formatUsd(feed.price) : '—'}
          title="proven from Chainlink's own AnswerUpdated transaction, not reported by us"
        />
        <Badge
          label="prosecutor"
          value={health.data ? `${Number(health.data.prosecutorBalanceCtc).toFixed(2)} CTC` : health.isError ? 'offline' : '…'}
          tone={health.data?.ok ? 'ok' : health.isError ? 'bad' : 'idle'}
          title={health.data ? shortHash(health.data.prosecutorAddress) : 'worker API unreachable'}
        />
        <ConnectButton />
      </div>
    </header>
  );
}

function Badge({ label, value, tone = 'idle', title }: { label: string; value: string; tone?: string; title?: string }) {
  return (
    <div className={`badge-stat tone-${tone}`} title={title}>
      <span className="badge-label">{label}</span>
      <span className="badge-value mono">{value}</span>
    </div>
  );
}
