'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  explorerTxUrl,
  formatCtc,
  formatUsd,
  ruleByIdOrNull,
  sourceChains,
  type ChainKey,
} from '@watchtower/shared';
import { CoverDialog } from '@/components/actions/CoverDialog';
import { FundWatchPanel } from '@/components/actions/FundWatchPanel';
import { StakePanel } from '@/components/actions/StakePanel';
import { IncidentCard } from '@/components/IncidentCard';
import { priceFor, reserveRatio, useChainState, useSubject } from '@/hooks/useChainState';
import { useIncidentFeed } from '@/hooks/useIncidentFeed';

/**
 * One risk, in full: what the rule proves, what the chain currently says, and every way a person can
 * participate in it.
 */
export default function SubjectDetail() {
  const params = useParams<{ id: string }>();
  const { subject, isLoading } = useSubject(params?.id);
  const { data: all = [] } = useChainState();
  const { incidents } = useIncidentFeed();

  if (isLoading) return <div className="dim small">reading the registry…</div>;
  if (!subject) return <div className="notice">No such subject in this deployment.</div>;

  const rule = ruleByIdOrNull(subject.boundRule);
  const chain = sourceChains[subject.chainKey as ChainKey];
  const ratio = reserveRatio(subject);
  const price = priceFor(subject, all);
  const mine = incidents.filter((i) => i.subjectId.toLowerCase() === subject.id.toLowerCase());

  return (
    <>
      <div className="page-head">
        <Link className="dim small" href="/subjects">← subjects</Link>
        <h2>{subject.label}</h2>
        <p className="dim">{rule?.headline ?? 'Unknown rule.'}</p>
      </div>

      <section className="detail-grid">
        <div className="panel">
          <span className="section-label">what is proven here</span>
          <p className="small">{rule?.headline}</p>
          <dl className="quote">
            <div><dt>rule</dt><dd>{rule?.name ?? '—'}</dd></div>
            <div><dt>chain</dt><dd>{chain?.label ?? subject.chainKey}</dd></div>
            <div>
              <dt>watching</dt>
              <dd>
                <a
                  className="mono"
                  href={`${chain?.explorer}/address/${subject.sourceContract}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {subject.sourceContract.slice(0, 10)}… ↗
                </a>
              </dd>
            </div>
            <div>
              <dt>proven up to</dt>
              <dd className="mono">
                {subject.cursorHeight > 0n
                  ? `${Number(subject.cursorHeight).toLocaleString()} · ${subject.cursorIndex}`
                  : 'nothing yet'}
              </dd>
            </div>
            <div><dt>payout cap</dt><dd>{formatCtc(subject.payoutCapPerBlock, 0)} / block</dd></div>
            <div><dt>priced at</dt><dd>{price > 0n ? formatUsd(price) : 'no proven price'}</dd></div>
          </dl>

          {subject.kind === 1 && (
            <div className="reserve">
              <span className="section-label">reserve</span>
              <div className="reserve-bar">
                <div
                  className={`reserve-fill ${ratio !== null && ratio < 1 ? 'bad' : 'ok'}`}
                  style={{ width: `${Math.min(100, (ratio ?? 0) * 100)}%` }}
                />
              </div>
              <div className="tile-meta dim">
                <span>locked {formatCtc(subject.locked, 4)}</span>
                <span>minted {formatCtc(subject.minted, 4)}</span>
              </div>
              <p className="dim small">
                Rebuilt from proven events since block {Number(subject.anchorHeight).toLocaleString()}.
                The protocol proves transactions, not balances &mdash; so this ledger is replayed, not read.
              </p>
            </div>
          )}
        </div>

        <div className="panel-stack">
          {subject.kind !== 2 && <CoverDialog subject={subject} />}
          <StakePanel subject={subject} />
          <FundWatchPanel subject={subject} />
        </div>
      </section>

      <section>
        <span className="section-label">incidents on this subject</span>
        {mine.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} />
        ))}
        {mine.length === 0 && <div className="empty small dim">Nothing proven against this subject yet.</div>}
      </section>
    </>
  );
}
