'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RULES, ruleByIdOrNull, type Incident } from '@watchtower/shared';
import { IncidentCard } from '@/components/IncidentCard';
import { useChainState } from '@/hooks/useChainState';
import { useIncidentFeed } from '@/hooks/useIncidentFeed';
import { useWorkerStatus } from '@/hooks/useWorkerStatus';

type Filter = 'all' | 'settled' | 'open' | 'rolled-back';

/** The archive. Every verdict this system has ever reached, and everything currently in flight. */
export default function IncidentsPage() {
  const { incidents, candidates, progress } = useIncidentFeed();
  const { data: subjects = [] } = useChainState();
  const { offline } = useWorkerStatus();
  const [status, setStatus] = useState<Filter>('all');
  const [ruleId, setRuleId] = useState<string>('all');

  const inFlight = candidates.filter((c) => !['CONFIRMED', 'UNPROVABLE'].includes(c.state));

  const shown = incidents.filter(
    (i) =>
      (status === 'all' || i.status === status) &&
      (ruleId === 'all' || i.ruleId.toLowerCase() === ruleId.toLowerCase()),
  );

  const labelOf = (i: Incident) =>
    subjects.find((s) => s.id.toLowerCase() === i.subjectId.toLowerCase())?.label;

  return (
    <>
      <div className="page-head">
        <h2>Incidents</h2>
        <p className="dim">
          Each card is a claim that was proven on-chain: the evidence coordinates, what it was worth,
          and what the vault paid.
        </p>
      </div>

      <div className="filters">
        <Segmented
          value={status}
          onChange={(v) => setStatus(v as Filter)}
          options={[
            ['all', 'All'],
            ['settled', 'Settled'],
            ['open', 'Open'],
            ['rolled-back', 'Rolled back'],
          ]}
        />
        <select className="select" value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
          <option value="all">every rule</option>
          {Object.values(RULES).map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {inFlight.length > 0 && (
        <section className="inflight">
          <span className="section-label">in flight</span>
          {inFlight.map((c) => (
            <div key={c.id} className="pipeline-row">
              <span className="pulse" />
              <span className="mono small">{c.id}</span>
              <span className="dim small">{progress[c.id] ?? c.state.toLowerCase()}</span>
            </div>
          ))}
        </section>
      )}

      {shown.map((incident) => (
        <Link key={incident.id} href={`/incidents/${incident.id}`} className="card-link-wrap">
          <IncidentCard incident={incident} subjectLabel={labelOf(incident)} />
        </Link>
      ))}

      {shown.length === 0 && inFlight.length === 0 && (
        <div className="empty">
          <p>{offline ? 'History is unavailable.' : 'Nothing matches.'}</p>
          <p className="dim small">
            {offline
              ? 'Incidents are served by the prosecutor worker, which is not reachable. Subjects, balances and every wallet action still work \u2014 those come from the chain.'
              : 'Watchtower proves two things Ethereum cannot check for itself: that a searcher bracketed a swap inside one block, and that a custodian minted more than it locked.'}
          </p>
        </div>
      )}
    </>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="segmented">
      {options.map(([key, label]) => (
        <button key={key} className={`seg ${value === key ? 'active' : ''}`} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </div>
  );
}
