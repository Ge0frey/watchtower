'use client';

import { useState } from 'react';
import { RULES, type Incident } from '@watchtower/shared';
import { IncidentCard } from '@/components/IncidentCard';
import { Empty, Label, PageHead, Select } from '@/components/ui';
import { useChainState } from '@/hooks/useChainState';
import { useIncidentFeed } from '@/hooks/useIncidentFeed';
import { useWorkerStatus } from '@/hooks/useWorkerStatus';

type Filter = 'all' | 'settled' | 'open' | 'rolled-back';

const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['settled', 'Settled'],
  ['open', 'Open'],
  ['rolled-back', 'Rolled back'],
];

/** The archive. Every verdict this system has reached, and everything in flight. */
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
      <PageHead
        eyebrow="The archive"
        title="Incidents"
        lede="Each card is a claim that was proven on-chain: the evidence coordinates, what it was worth, and what the vault paid."
      />

      {/* ---------------------------------------------------------- filters */}
      <div className="mb-12 flex flex-wrap items-center gap-5 border-b border-ink/12 pb-6">
        <div className="flex overflow-hidden rounded-md border border-ink/20">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatus(key)}
              className={`border-r border-ink/20 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors last:border-r-0 ${
                status === key ? 'bg-ink text-paper' : 'text-ink/60 hover:bg-card hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-64">
          <Select value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
            <option value="all">every rule</option>
            {Object.values(RULES).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>

        <span className="ml-auto font-mono text-[11px] text-ink/50">
          {shown.length} of {incidents.length}
        </span>
      </div>

      {inFlight.length > 0 && (
        <section className="mb-14">
          <Label className="mb-4 block">In flight</Label>
          <div className="space-y-3">
            {inFlight.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-5 border border-dashed border-ink/25 bg-card px-6 py-4"
              >
                <span className="font-mono text-[12.5px]">{c.id}</span>
                <span className="font-mono text-[11.5px] text-ink/45">
                  {progress[c.id] ?? c.state.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-6">
        {shown.map((incident) => (
          <IncidentCard
            key={incident.id}
            incident={incident}
            subjectLabel={labelOf(incident)}
            href={`/incidents/${incident.id}`}
          />
        ))}
      </div>

      {shown.length === 0 && inFlight.length === 0 && (
        <Empty title={offline ? 'History is unavailable' : 'Nothing matches'}>
          {offline
            ? 'Incidents are served by the prosecutor worker, which is not reachable. Subjects, balances and every wallet action still work — those come from the chain.'
            : 'Watchtower proves things Ethereum cannot check for itself: that a searcher bracketed a swap inside one block, and that a custodian minted more than it locked.'}
        </Empty>
      )}
    </>
  );
}
