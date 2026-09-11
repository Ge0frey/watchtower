'use client';

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

const STATUS_COPY: Record<Incident['status'], { label: string; tone: string }> = {
  none: { label: 'pending', tone: 'idle' },
  open: { label: 'breach open · challengeable', tone: 'warn' },
  settled: { label: 'settled', tone: 'ok' },
  'rolled-back': { label: 'rolled back · bond slashed', tone: 'bad' },
};

/**
 * One card format for every verdict.
 *
 * A sandwich and an insolvency look like siblings here because they are: the same engine judged them,
 * the same vault paid them, and the same coordinate identifies the evidence. Only the window shape
 * differs, which is exactly what the strip above each card shows.
 */
export function IncidentCard({ incident, subjectLabel }: { incident: Incident; subjectLabel?: string }) {
  const rule = ruleByIdOrNull(incident.ruleId);
  const status = STATUS_COPY[incident.status];
  const isIntraBlock = rule?.name === 'IntraBlockExtraction';
  const first = incident.evidence[0];

  const cells = isIntraBlock && first
    ? sandwichCells(first.txIndex)
    : streamCells(incident.evidence.map((e) => ({ blockHeight: e.blockHeight, txIndex: e.txIndex })));

  const freshness = freshnessLabel(incident.continuityLength);

  return (
    <article className={`card tone-${status.tone}`}>
      <header className="card-head">
        <div>
          <span className="card-rule">{rule?.name ?? 'Unknown rule'}</span>
          {subjectLabel && <span className="card-subject dim">{subjectLabel}</span>}
          <span className={`badge badge-${status.tone}`}>{status.label}</span>
        </div>
        <span className="mono dim">{shortHash(incident.id)}</span>
      </header>

      {cells.length > 0 && (
        <BlockStrip
          cells={cells}
          blockHeight={first?.blockHeight}
          mode={isIntraBlock ? 'intra-block' : 'stream'}
        />
      )}

      <div className="card-grid">
        <Field label="damages" value={formatUsd(incident.damagesUsd)} strong />
        <Field label="paid" value={formatCtc(incident.paid)} strong />
        <Field label="beneficiary" value={shortHash(incident.beneficiary)} mono />
        <Field label="prosecutor" value={shortHash(incident.prosecutor)} mono />
      </div>

      <div className="card-evidence">
        {incident.evidence.slice(0, 4).map((coord, i) =>
          coord.txHash ? (
            <a
              key={`${coord.blockHeight}-${coord.txIndex}-${i}`}
              className="chip chip-link"
              href={explorerTxUrl(coord.chainKey as ChainKey, coord.txHash)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="evidence coordinate (block · index) - open on Etherscan"
            >
              {formatCoord(coord.blockHeight, coord.txIndex)} ↗
            </a>
          ) : (
            <span key={`${coord.blockHeight}-${coord.txIndex}-${i}`} className="chip" title="evidence coordinate">
              {formatCoord(coord.blockHeight, coord.txIndex)}
            </span>
          ),
        )}
        <span className={`chip freshness-${freshness}`} title="continuity proof length - the protocol's own cost driver">
          {incident.continuityLength} roots · {freshness}
        </span>
      </div>

      {incident.creditcoinTxHash && (
        <a className="card-link" href={creditcoinTxUrl(incident.creditcoinTxHash)} target="_blank" rel="noreferrer">
          verdict on Creditcoin ↗
        </a>
      )}
    </article>
  );
}

function Field({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className={`field-value ${mono ? 'mono' : ''} ${strong ? 'strong' : ''}`}>{value}</span>
    </div>
  );
}
