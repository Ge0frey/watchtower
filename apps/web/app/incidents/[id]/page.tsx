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
import { useChainState } from '@/hooks/useChainState';
import { useIncidentFeed } from '@/hooks/useIncidentFeed';

/**
 * One incident, at full size.
 *
 * The block strip is the hero: it renders the coordinate an Ethereum contract cannot observe about
 * its own neighbours. An intra-block incident lights three adjacent cells with the untouched
 * positions dimmed around them; a stream incident lights a run across blocks.
 */
export default function IncidentDetail() {
  const params = useParams<{ id: string }>();
  const { incidents } = useIncidentFeed();
  const { data: subjects = [] } = useChainState();

  const incident = incidents.find((i) => i.id.toLowerCase() === (params?.id ?? '').toLowerCase());
  if (!incident) {
    return (
      <div className="notice">
        No such incident in this worker&rsquo;s history. <Link href="/incidents">Back to the archive</Link>.
      </div>
    );
  }

  const rule = ruleByIdOrNull(incident.ruleId);
  const subject = subjects.find((s) => s.id.toLowerCase() === incident.subjectId.toLowerCase());
  const isIntraBlock = rule?.name === 'IntraBlockExtraction';
  const first = incident.evidence[0];
  const cells = isIntraBlock && first
    ? sandwichCells(first.txIndex)
    : streamCells(incident.evidence.map((e) => ({ blockHeight: e.blockHeight, txIndex: e.txIndex })));

  return (
    <>
      <div className="page-head">
        <Link className="dim small" href="/incidents">← incidents</Link>
        <h2>{rule?.name ?? 'Incident'}</h2>
        <p className="dim">
          {subject?.label ?? shortHash(incident.subjectId)} · {rule?.headline}
        </p>
      </div>

      <section className="panel hero-strip">
        {cells.length > 0 ? (
          <BlockStrip cells={cells} blockHeight={first?.blockHeight} mode={isIntraBlock ? 'intra-block' : 'stream'} />
        ) : (
          <p className="dim small">No evidence coordinates recorded for this incident.</p>
        )}
      </section>

      <section className="detail-grid">
        <div className="panel">
          <span className="section-label">verdict</span>
          <dl className="quote">
            <div><dt>status</dt><dd>{incident.status}</dd></div>
            <div><dt>damages</dt><dd className="strong">{formatUsd(incident.damagesUsd)}</dd></div>
            <div><dt>paid</dt><dd className="strong">{formatCtc(incident.paid)}</dd></div>
            <div><dt>beneficiary</dt><dd className="mono">{shortHash(incident.beneficiary)}</dd></div>
            <div><dt>prosecutor</dt><dd className="mono">{shortHash(incident.prosecutor)}</dd></div>
            <div>
              <dt>continuity</dt>
              <dd>{incident.continuityLength} roots · {freshnessLabel(incident.continuityLength)}</dd>
            </div>
          </dl>
          {incident.creditcoinTxHash && (
            <a className="card-link" href={creditcoinTxUrl(incident.creditcoinTxHash)} target="_blank" rel="noreferrer">
              verdict on Creditcoin ↗
            </a>
          )}
        </div>

        <div className="panel">
          <span className="section-label">evidence</span>
          <p className="dim small">
            Each row was verified by the Block Prover Precompile before the rule was allowed to judge
            it. The index is the transaction&rsquo;s position inside its Ethereum block.
          </p>
          <ul className="evidence-list">
            {incident.evidence.map((coord, i) => (
              <li key={`${coord.blockHeight}-${coord.txIndex}-${i}`}>
                <span className="mono">{formatCoord(coord.blockHeight, coord.txIndex)}</span>
                {coord.txHash && (
                  <a href={explorerTxUrl(coord.chainKey as ChainKey, coord.txHash)} target="_blank" rel="noreferrer">
                    on Etherscan ↗
                  </a>
                )}
              </li>
            ))}
            {incident.evidence.length === 0 && <li className="dim small">none recorded</li>}
          </ul>
        </div>
      </section>

      <ChallengePanel incident={incident} />
    </>
  );
}
