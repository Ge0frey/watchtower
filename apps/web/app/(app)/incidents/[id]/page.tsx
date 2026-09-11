'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  creditcoinTxUrl,
  explorerTxUrl,
  formatCoord,
  formatCtc,
  formatUsd,
  freshnessLabel,
  ruleByIdOrNull,
  shortHash,
  type ChainKey,
} from '@watchtower/shared';
import { BlockStrip, sandwichCells, streamCells } from '@/components/BlockStrip';
import { ChallengePanel } from '@/components/actions/ChallengePanel';
import { ArrowLink, Badge, Label, Notice, Row, Section, type Tone } from '@/components/ui';
import { useChainState } from '@/hooks/useChainState';
import { useIncidentFeed } from '@/hooks/useIncidentFeed';

const STATUS_TONE: Record<string, Tone> = {
  none: 'neutral',
  open: 'pending',
  settled: 'settled',
  'rolled-back': 'breach',
};

/**
 * One incident, at full size.
 *
 * The block strip is the hero and gets the whole width: it renders the coordinate an
 * Ethereum contract cannot observe about its own neighbours. Everything below it is
 * the paperwork — who was owed, what moved, and the links that let a sceptic check
 * all of it against two block explorers.
 */
export default function IncidentDetail() {
  const params = useParams<{ id: string }>();
  const { incidents } = useIncidentFeed();
  const { data: subjects = [] } = useChainState();

  const incident = incidents.find((i) => i.id.toLowerCase() === (params?.id ?? '').toLowerCase());

  if (!incident) {
    return (
      <Notice>
        No such incident in this worker&rsquo;s history.{' '}
        <Link href="/incidents" className="underline underline-offset-4">
          Back to the archive
        </Link>
        .
      </Notice>
    );
  }

  const rule = ruleByIdOrNull(incident.ruleId);
  const subject = subjects.find((s) => s.id.toLowerCase() === incident.subjectId.toLowerCase());
  const isIntraBlock = rule?.name === 'IntraBlockExtraction';
  const first = incident.evidence[0];
  const freshness = freshnessLabel(incident.continuityLength);

  const cells =
    isIntraBlock && first
      ? sandwichCells(first.txIndex)
      : streamCells(incident.evidence.map((e) => ({ blockHeight: e.blockHeight, txIndex: e.txIndex })));

  return (
    <>
      <header className="mb-14 border-b border-ink/12 pb-10">
        <Link href="/incidents" className="inline-block">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/45 transition-colors hover:text-ink">
            ← Incidents
          </span>
        </Link>

        <div className="mt-7 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <h1 className="display text-[clamp(2.25rem,6vw,4rem)]">{rule?.name ?? 'Incident'}</h1>
            <p className="mt-5 max-w-[62ch] text-[16px] leading-relaxed text-ink/60">
              {subject ? (
                <Link href={`/subjects/${subject.id}`} className="text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink">
                  {subject.label}
                </Link>
              ) : (
                shortHash(incident.subjectId)
              )}
              {rule?.headline && <span className="text-ink/45"> · {rule.headline}</span>}
            </p>
          </div>
          <Badge tone={STATUS_TONE[incident.status] ?? 'neutral'}>
            {incident.status}
          </Badge>
        </div>
      </header>

      {/* The hero: the coordinate itself. */}
      <section className="rounded-lg border border-ink/12 bg-card p-8 md:p-12">
        <p className="label mb-8 text-ink/50">The evidence coordinate</p>
        {cells.length > 0 ? (
          <BlockStrip
            cells={cells}
            blockHeight={first?.blockHeight}
            mode={isIntraBlock ? 'intra-block' : 'stream'}
          />
        ) : (
          <p className="text-[14px] text-ink/50">No evidence coordinates recorded for this incident.</p>
        )}
      </section>

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <Section title="Verdict">
          <div>
            <Row label="status" value={incident.status} mono={false} tone={STATUS_TONE[incident.status]} />
            <Row label="damages" value={formatUsd(incident.damagesUsd)} />
            <Row label="paid" value={formatCtc(incident.paid)} tone={incident.paid > 0n ? 'settled' : 'neutral'} />
            <Row label="beneficiary" value={shortHash(incident.beneficiary)} />
            <Row label="prosecutor" value={shortHash(incident.prosecutor)} />
            <Row
              label="continuity"
              value={`${incident.continuityLength} roots · ${freshness}`}
              tone={freshness === 'fresh' ? 'settled' : freshness === 'aging' ? 'pending' : 'breach'}
            />
          </div>

          {incident.creditcoinTxHash && (
            <a
              className="mt-8 inline-block"
              href={creditcoinTxUrl(incident.creditcoinTxHash)}
              target="_blank"
              rel="noreferrer"
            >
              <ArrowLink>Verdict on Creditcoin ↗</ArrowLink>
            </a>
          )}
        </Section>

        <Section title="Evidence">
          <p className="mb-7 max-w-[56ch] text-[14px] leading-relaxed text-ink/55">
            Each row was verified by the Block Prover Precompile before the rule was allowed to judge
            it. The index is the transaction&rsquo;s position inside its Ethereum block &mdash; the
            fact no Ethereum contract can observe about its neighbours.
          </p>

          {incident.evidence.length === 0 ? (
            <p className="font-mono text-[12px] text-ink/50">none recorded</p>
          ) : (
            <ol className="space-y-3">
              {incident.evidence.map((coord, i) => (
                <li
                  key={`${coord.blockHeight}-${coord.txIndex}-${i}`}
                  className="flex items-center justify-between gap-5 rounded-md border border-ink/12 px-5 py-4"
                >
                  <span className="flex items-center gap-4">
                    <span className="font-mono text-[11px] text-ink/30">{String(i + 1).padStart(2, '0')}</span>
                    <span className="font-mono text-[13px] text-accent-deep">
                      {formatCoord(coord.blockHeight, coord.txIndex)}
                    </span>
                  </span>
                  {coord.txHash && (
                    <a
                      href={explorerTxUrl(coord.chainKey as ChainKey, coord.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[11px] text-ink/45 underline decoration-ink/20 underline-offset-4 transition-colors hover:text-ink"
                    >
                      Etherscan ↗
                    </a>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>

      {incident.status === 'open' && (
        <div className="mt-12">
          <Label className="mb-5 block">The defence</Label>
          <ChallengePanel incident={incident} />
        </div>
      )}
    </>
  );
}
