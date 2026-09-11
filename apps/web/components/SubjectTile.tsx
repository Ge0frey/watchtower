'use client';

import { formatCtc, formatUsd, sourceChains, type ChainKey } from '@watchtower/shared';
import { reserveRatio, type ChainSubject } from '@/hooks/useChainState';

const KIND_LABEL = ['pool', 'custodian', 'feed', 'account'];

/**
 * One health tile per subject. What it shows depends on what the subject is: a custodian shows its
 * reserve ratio, a feed shows the proven answer, a pool shows what it has paid out.
 *
 * Every tile shows the proven head, because how current the evidence is matters as much as the
 * value it reports.
 */
export function SubjectTile({ subject }: { subject: ChainSubject }) {
  const ratio = reserveRatio(subject);
  const kind = KIND_LABEL[subject.kind] ?? 'subject';
  const chain = sourceChains[subject.chainKey as ChainKey];

  const health =
    subject.kind === 1
      ? ratio === null
        ? { tone: 'idle', text: 'no evidence yet' }
        : ratio >= 1
          ? { tone: 'ok', text: `reserve ${(ratio * 100).toFixed(1)}%` }
          : { tone: 'bad', text: `SHORTFALL ${(ratio * 100).toFixed(1)}%` }
      : subject.kind === 2
        ? { tone: subject.price > 0n ? 'ok' : 'idle', text: subject.price > 0n ? formatUsd(subject.price) : 'no price yet' }
        : { tone: subject.paidOut > 0n ? 'warn' : 'ok', text: `paid ${formatCtc(subject.paidOut)}` };

  return (
    <div className={`tile tone-${health.tone} ${subject.frozen ? 'frozen' : ''}`}>
      <div className="tile-head">
        <span className="tile-label">{subject.label}</span>
        <span className="tile-kind">{kind}</span>
      </div>
      <div className="tile-health">{health.text}</div>
      <div className="tile-meta">
        <span>{chain?.label ?? `chainKey ${subject.chainKey}`}</span>
        <span className="mono">
          {subject.cursorHeight > 0n
            ? `proven ▸ ${Number(subject.cursorHeight).toLocaleString()} · ${subject.cursorIndex}`
            : 'unanchored'}
        </span>
      </div>
      <div className="tile-meta dim">
        <span>staked {formatCtc(subject.staked, 2)}</span>
        <span>bounty {formatCtc(subject.bountyPool, 2)}</span>
      </div>
      {subject.frozen && <div className="tile-flag">frozen — breach awaiting settlement</div>}
    </div>
  );
}
