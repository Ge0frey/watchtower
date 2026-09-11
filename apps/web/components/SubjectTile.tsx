'use client';

import Link from 'next/link';
import { formatCtc, formatUsd, sourceChains, type ChainKey } from '@watchtower/shared';
import { reserveRatio, type ChainSubject } from '@/hooks/useChainState';
import { Badge, type Tone } from '@/components/ui';

const KIND = ['Pool', 'Custodian', 'Feed', 'Account'];

/**
 * One health tile per subject.
 *
 * What it shows depends on what the subject is — a custodian shows its reserve ratio,
 * a feed shows the proven answer, a pool shows what it has paid out — but every tile
 * shows the proven head, because how current the evidence is matters as much as the
 * value it reports. A number with no coordinate behind it is just a number.
 */
export function SubjectTile({ subject }: { subject: ChainSubject }) {
  const ratio = reserveRatio(subject);
  const chain = sourceChains[subject.chainKey as ChainKey];

  const health = healthOf(subject, ratio);

  return (
    <Link
      href={`/subjects/${subject.id}`}
      className={`group flex flex-col rounded-lg border bg-card p-7 transition-colors ${
        subject.frozen ? 'border-open/40 hover:border-open' : 'border-ink/12 hover:border-accent'
      }`}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="display text-[22px] leading-tight">{subject.label}</h3>
          <p className="label mt-2.5 text-ink/50">
            {KIND[subject.kind] ?? 'Subject'} · {chain?.label ?? `chainKey ${subject.chainKey}`}
          </p>
        </div>
        <Badge tone={health.tone}>{health.badge}</Badge>
      </header>

      <div className="mt-10 flex-1">
        <p
          className={`text-[34px] leading-none tracking-tight ${
            // Mono is reserved for what the chain produced. "no claims" is our
            // sentence about the chain, so it is set in the interface face.
            health.numeric ? 'font-mono' : 'display'
          } ${
            health.tone === 'breach'
              ? 'text-breach'
              : health.tone === 'proven'
                ? 'text-accent-deep'
                : health.tone === 'neutral'
                  ? 'text-ink/35'
                  : 'text-ink'
          }`}
        >
          {health.value}
        </p>
        <p className="mt-4 max-w-[36ch] text-[12.5px] leading-snug text-ink/45">{health.caption}</p>
      </div>

      <dl className="mt-9 space-y-2.5 border-t border-ink/10 pt-5 font-mono text-[11.5px]">
        <div className="flex justify-between gap-4">
          <dt className="text-ink/50">proven head</dt>
          <dd className={subject.cursorHeight > 0n ? 'text-accent-deep' : 'text-ink/30'}>
            {subject.cursorHeight > 0n
              ? `${Number(subject.cursorHeight).toLocaleString()} · ${subject.cursorIndex}`
              : 'unanchored'}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink/50">staked</dt>
          <dd className="text-ink/70">{formatCtc(subject.staked, 2)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink/50">bounty</dt>
          <dd className="text-ink/70">{formatCtc(subject.bountyPool, 2)}</dd>
        </div>
      </dl>

      {subject.frozen && (
        <p className="mt-5 border-t border-open/35 pt-4 font-mono text-[11px] text-open">
          frozen — breach awaiting settlement
        </p>
      )}
    </Link>
  );
}

function healthOf(
  subject: ChainSubject,
  ratio: number | null,
): { tone: Tone; badge: string; value: string; caption: string; numeric: boolean } {
  // Custodian: the reserve ratio is the whole story, and a shortfall is the headline.
  if (subject.kind === 1) {
    if (ratio === null)
      return { tone: 'neutral', badge: 'idle', value: '—', caption: 'no evidence ingested yet', numeric: true };
    return ratio >= 1
      ? {
          tone: 'settled',
          badge: 'solvent',
          value: `${(ratio * 100).toFixed(1)}%`,
          caption: 'reserve ratio, replayed from proven events',
          numeric: true,
        }
      : {
          tone: 'breach',
          badge: 'shortfall',
          value: `${(ratio * 100).toFixed(1)}%`,
          caption: 'minted exceeds locked — a breach is provable',
          numeric: true,
        };
  }

  // Feed: a price is either proven or it is nothing.
  if (subject.kind === 2) {
    return subject.price > 0n
      ? {
          tone: 'proven',
          badge: 'proven',
          value: formatUsd(subject.price),
          caption: "Chainlink's own published answer",
          numeric: true,
        }
      : { tone: 'neutral', badge: 'idle', value: '—', caption: 'no round ingested yet', numeric: true };
  }

  // Pool and account: what has this subject actually cost the vault?
  return subject.paidOut > 0n
    ? {
        tone: 'pending',
        badge: 'claims paid',
        value: formatCtc(subject.paidOut, 2),
        caption: 'restitution paid out of this tranche',
        numeric: true,
      }
    : {
        tone: 'settled',
        badge: 'watched',
        value: 'No claims',
        caption: 'nothing proven against it yet',
        numeric: false,
      };
}
