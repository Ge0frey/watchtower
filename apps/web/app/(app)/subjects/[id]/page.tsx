'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatCtc, formatUsd, ruleByIdOrNull, sourceChains, type ChainKey } from '@watchtower/shared';
import { CoverDialog } from '@/components/actions/CoverDialog';
import { FundWatchPanel } from '@/components/actions/FundWatchPanel';
import { StakePanel } from '@/components/actions/StakePanel';
import { IncidentCard } from '@/components/IncidentCard';
import { Badge, Empty, Label, Notice, Row, Section } from '@/components/ui';
import { priceFor, reserveRatio, useChainState, useSubject } from '@/hooks/useChainState';
import { useIncidentFeed } from '@/hooks/useIncidentFeed';

/**
 * One risk, in full: what the rule proves, what the chain currently says, and every
 * way a person can participate in it.
 *
 * The three actions sit in a column on the right and never move between subjects, so
 * buying cover on a pool and underwriting a bridge are the same gesture in the same
 * place.
 */
export default function SubjectDetail() {
  const params = useParams<{ id: string }>();
  const { subject, isLoading } = useSubject(params?.id);
  const { data: all = [] } = useChainState();
  const { incidents } = useIncidentFeed();

  if (isLoading) return <p className="font-mono text-[12px] text-ink/45">reading the registry…</p>;
  if (!subject) return <Notice tone="breach">No such subject in this deployment.</Notice>;

  const rule = ruleByIdOrNull(subject.boundRule);
  const chain = sourceChains[subject.chainKey as ChainKey];
  const ratio = reserveRatio(subject);
  const price = priceFor(subject, all);
  const mine = incidents.filter((i) => i.subjectId.toLowerCase() === subject.id.toLowerCase());

  return (
    <>
      <header className="mb-14 border-b border-ink/12 pb-10">
        <Link href="/subjects" className="inline-block">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/45 transition-colors hover:text-ink">
            ← Subjects
          </span>
        </Link>

        <div className="mt-7 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <h1 className="display text-[clamp(2.25rem,6vw,4rem)]">{subject.label}</h1>
            <p className="mt-5 max-w-[62ch] text-[16px] leading-relaxed text-ink/60">
              {rule?.headline ?? 'Unknown rule.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Badge tone="proven">{rule?.name ?? 'unknown rule'}</Badge>
            {subject.frozen && (
              <Badge tone="pending">frozen</Badge>
            )}
            {!subject.active && <Badge tone="breach">paused</Badge>}
          </div>
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-10">
          <Section title="What is proven here">
            <div>
              <Row label="rule" value={rule?.name ?? '—'} mono={false} />
              <Row label="source chain" value={chain?.label ?? String(subject.chainKey)} mono={false} />
              <Row
                label="watching"
                value={
                  <a
                    className="underline decoration-ink/25 underline-offset-4 transition-colors hover:decoration-ink"
                    href={`${chain?.explorer}/address/${subject.sourceContract}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {subject.sourceContract.slice(0, 12)}… ↗
                  </a>
                }
              />
              <Row
                label="proven up to"
                tone={subject.cursorHeight > 0n ? 'proven' : 'neutral'}
                value={
                  subject.cursorHeight > 0n
                    ? `${Number(subject.cursorHeight).toLocaleString()} · ${subject.cursorIndex}`
                    : 'nothing yet'
                }
              />
              <Row label="payout cap" value={`${formatCtc(subject.payoutCapPerBlock, 0)} / block`} />
              <Row label="priced at" value={price > 0n ? formatUsd(price) : 'no proven price'} />
            </div>
          </Section>

          {subject.kind === 1 && (
            <Section
              title="Reserve ledger"
              aside={
                ratio !== null && (
                  <Badge tone={ratio >= 1 ? 'settled' : 'breach'}>{(ratio * 100).toFixed(1)}%</Badge>
                )
              }
            >
              <div className="h-3 w-full overflow-hidden rounded-sm bg-paper-dim">
                <div
                  className={`h-full transition-all duration-500 ${
                    ratio !== null && ratio < 1 ? 'bg-breach' : 'bg-settled'
                  }`}
                  style={{ width: `${Math.min(100, (ratio ?? 0) * 100)}%` }}
                />
              </div>
              <div className="mt-8 grid grid-cols-2 gap-8">
                <div>
                  <Label className="mb-2.5 block">locked</Label>
                  <p className="font-mono text-[22px] leading-none">{formatCtc(subject.locked, 4)}</p>
                </div>
                <div>
                  <Label className="mb-2.5 block">minted</Label>
                  <p className="font-mono text-[22px] leading-none">{formatCtc(subject.minted, 4)}</p>
                </div>
              </div>
              <p className="mt-8 max-w-[60ch] border-t border-ink/10 pt-6 text-[13px] leading-relaxed text-ink/50">
                Rebuilt from proven events since block{' '}
                {Number(subject.anchorHeight).toLocaleString()}. The protocol proves transactions,
                not balances &mdash; so this ledger is replayed, never read.
              </p>
            </Section>
          )}

        </div>

        <aside className="space-y-8 lg:sticky lg:top-40">
          {subject.kind !== 2 && <CoverDialog subject={subject} />}
          <StakePanel subject={subject} />
          <FundWatchPanel subject={subject} />
        </aside>
      </div>

      <section className="mt-20">
        <Label className="mb-5 block">Incidents on this subject</Label>
        {mine.length === 0 ? (
          <Empty title="Nothing proven against this subject yet">
            A verdict appears here the moment someone proves one on Creditcoin.
          </Empty>
        ) : (
          <div className="space-y-6">
            {mine.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} href={`/incidents/${incident.id}`} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
