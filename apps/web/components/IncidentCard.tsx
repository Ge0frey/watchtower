'use client';

import Link from 'next/link';
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
  type Incident,
} from '@watchtower/shared';
import { BlockStrip, sandwichCells, streamCells } from './BlockStrip';
import { Badge, type Tone } from '@/components/ui';

const STATUS: Record<Incident['status'], { label: string; tone: Tone }> = {
  none: { label: 'pending', tone: 'neutral' },
  open: { label: 'breach open · challengeable', tone: 'pending' },
  settled: { label: 'settled', tone: 'settled' },
  'rolled-back': { label: 'rolled back · bond slashed', tone: 'breach' },
};

const FRESHNESS: Record<'fresh' | 'aging' | 'stale', Tone> = {
  fresh: 'settled',
  aging: 'pending',
  stale: 'breach',
};

/**
 * One card format for every verdict.
 *
 * A sandwich and an insolvency look like siblings here because they are: the same
 * engine judged them, the same vault paid them, and the same coordinate identifies
 * the evidence. Only the window shape differs — which is exactly what the strip at
 * the top of the card shows.
 */
export function IncidentCard({
  incident,
  subjectLabel,
  href,
}: {
  incident: Incident;
  subjectLabel?: string;
  href?: string;
}) {
  const rule = ruleByIdOrNull(incident.ruleId);
  const status = STATUS[incident.status];
  const isIntraBlock = rule?.name === 'IntraBlockExtraction';
  const first = incident.evidence[0];

  const cells =
    isIntraBlock && first
      ? sandwichCells(first.txIndex)
      : streamCells(incident.evidence.map((e) => ({ blockHeight: e.blockHeight, txIndex: e.txIndex })));

  const freshness = freshnessLabel(incident.continuityLength);

  // A real mainnet victim is a stranger who never bought cover, so a genuine
  // prosecution routinely lands here: damages proven, payout zero. Left
  // unexplained that reads as a broken number.
  const uninsured = incident.status === 'settled' && incident.damagesUsd > 0n && incident.paid === 0n;

  const body = (
    <article className="overflow-hidden rounded-lg border border-ink/12 bg-card transition-colors group-hover:border-accent">
      <header className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-b border-ink/10 px-7 py-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h3 className="display text-[21px]">{rule?.name ?? 'Unknown rule'}</h3>
          {subjectLabel && <span className="text-[13px] text-ink/45">{subjectLabel}</span>}
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <span className="font-mono text-[11px] text-ink/30">{shortHash(incident.id)}</span>
      </header>

      {cells.length > 0 && (
        <div className="border-b border-ink/10 px-7 py-8">
          <BlockStrip
            cells={cells}
            blockHeight={first?.blockHeight}
            mode={isIntraBlock ? 'intra-block' : 'stream'}
            size="sm"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-px border-b border-ink/10 bg-ink/10 md:grid-cols-4">
        <Cell label="damages" value={formatUsd(incident.damagesUsd)} strong />
        <Cell label="paid" value={formatCtc(incident.paid)} strong tone={incident.paid > 0n ? 'settled' : 'neutral'} />
        <Cell label="beneficiary" value={shortHash(incident.beneficiary)} />
        <Cell label="prosecutor" value={shortHash(incident.prosecutor)} />
      </div>

      {uninsured && (
        <p className="border-b border-ink/10 px-7 py-5 text-[13.5px] leading-relaxed text-ink/55">
          Proven, priced, and unpaid: the beneficiary holds no cover on this subject. The verdict
          stands on its own &mdash; the prosecutor still collected the bounty for proving it &mdash;
          but restitution only reaches someone who bought cover.{' '}
          <span className="text-ink">Insurance pays the insured.</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2.5 px-7 py-5">
        {incident.evidence.slice(0, 4).map((coord, i) =>
          coord.txHash ? (
            <a
              key={`${coord.blockHeight}-${coord.txIndex}-${i}`}
              href={explorerTxUrl(coord.chainKey as ChainKey, coord.txHash)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="evidence coordinate (block · index) — open on Etherscan"
              className="inline-flex items-center gap-2 rounded-md border border-accent/40 px-2.5 py-1.5 font-mono text-[11px] text-accent-deep transition-colors hover:border-accent hover:bg-accent hover:text-ink"
            >
              {formatCoord(coord.blockHeight, coord.txIndex)} ↗
            </a>
          ) : (
            <span
              key={`${coord.blockHeight}-${coord.txIndex}-${i}`}
              title="evidence coordinate"
              className="rounded-md border border-ink/15 px-2.5 py-1.5 font-mono text-[11px] text-ink/50"
            >
              {formatCoord(coord.blockHeight, coord.txIndex)}
            </span>
          ),
        )}

        <Badge tone={FRESHNESS[freshness]} title="continuity proof length — the protocol's own cost driver">
          {incident.continuityLength} roots · {freshness}
        </Badge>

        {incident.creditcoinTxHash && (
          <a
            href={creditcoinTxUrl(incident.creditcoinTxHash)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto font-mono text-[11px] text-ink/45 underline decoration-ink/20 underline-offset-4 transition-colors hover:text-ink"
          >
            verdict on Creditcoin ↗
          </a>
        )}
      </div>
    </article>
  );

  if (!href) return body;
  return (
    <Link href={href} className="group block">
      {body}
    </Link>
  );
}

function Cell({
  label,
  value,
  strong,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: Tone;
}) {
  const color =
    tone === 'settled' ? 'text-settled' : tone === 'breach' ? 'text-breach' : strong ? 'text-ink' : 'text-ink/60';
  return (
    <div className="bg-card px-7 py-5">
      <p className="label mb-3 text-ink/50">{label}</p>
      <p className={`font-mono ${strong ? 'text-[17px]' : 'text-[13px]'} ${color}`}>{value}</p>
    </div>
  );
}
