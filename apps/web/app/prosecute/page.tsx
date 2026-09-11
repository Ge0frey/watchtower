'use client';

import { useState } from 'react';
import { RULES, formatCtc, watchtowerCoreAbi } from '@watchtower/shared';
import { rehydrate } from '@/components/actions/ChallengePanel';
import { ConnectGate, TxState } from '@/components/actions/TxButton';
import { CORE, useChainState } from '@/hooks/useChainState';
import { useIncidentFeed } from '@/hooks/useIncidentFeed';
import { useWatchtowerWrite } from '@/hooks/useWatchtowerWrite';
import { api } from '@/lib/api';

type Mode = 'relayed' | 'self';

/**
 * The prosecutor console.
 *
 * Two doors to the same verdict. **Relayed**: the worker builds the proof, pays the gas, and takes
 * the bounty - so anyone can try this without holding CTC. **Self**: the worker returns ready-to-sign
 * calldata, your wallet submits it, and the bounty is yours.
 *
 * Neither door can forge anything. The worker only assembles proofs; the Attestcoin Smart Contract
 * re-verifies every one inside the transaction that settles, so a dishonest submission reverts.
 */
export default function ProsecutePage() {
  const { data: subjects = [] } = useChainState();
  const { candidates, progress } = useIncidentFeed();
  const [mode, setMode] = useState<Mode>('relayed');
  const [value, setValue] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const write = useWatchtowerWrite();

  const hashes = value.split(/[\s,]+/).map((h) => h.trim()).filter((h) => /^0x[0-9a-fA-F]{64}$/.test(h));
  const insurable = subjects.filter((s) => s.kind !== 2);
  const selected = subjects.find((s) => s.id === subjectId) ?? insurable[0];
  const ruleId = hashes.length === 3 ? RULES.intraBlockExtraction.id : RULES.failedTx.id;

  async function run() {
    if (!selected || hashes.length === 0) return;
    setBusy(true);
    setStatus(mode === 'relayed' ? 'queued with the worker — watch the pipeline below' : 'building proof…');
    try {
      const result = await api.prosecute({
        txHashes: hashes,
        subjectId: selected.id,
        ruleId,
        chainKey: selected.chainKey,
        mode,
      });

      if (mode === 'self') {
        setStatus(`proof ready — ${result.continuityLength} continuity roots${result.cached ? ' (cached)' : ''}`);
        await write.send({
          address: CORE,
          abi: watchtowerCoreAbi,
          functionName: 'submitEvidence',
          args: [rehydrate(result.input)],
        });
      } else {
        setStatus(`queued as ${result.candidateId}`);
        setValue('');
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  }

  const inFlight = candidates.filter((c) => !['CONFIRMED', 'UNPROVABLE'].includes(c.state));

  return (
    <>
      <div className="page-head">
        <h2>Prosecute</h2>
        <p className="dim">
          Paste an Ethereum transaction and get a verdict. Three hashes from one block are read as a
          sandwich; a single hash is read as a failed transaction.
        </p>
      </div>

      <section className="panel">
        <div className="filters">
          <div className="segmented">
            <button className={`seg ${mode === 'relayed' ? 'active' : ''}`} onClick={() => setMode('relayed')}>
              Relayed
            </button>
            <button className={`seg ${mode === 'self' ? 'active' : ''}`} onClick={() => setMode('self')}>
              Sign it myself
            </button>
          </div>
          <select className="select" value={selected?.id ?? ''} onChange={(e) => setSubjectId(e.target.value)}>
            {insurable.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        <p className="dim small">
          {mode === 'relayed'
            ? 'The worker builds the proof, pays the gas, and takes the bounty. No wallet needed.'
            : `The worker returns calldata; your wallet submits it and the bounty is yours${
                selected ? ` — pool currently ${formatCtc(selected.bountyPool, 3)}` : ''
              }.`}
        </p>

        <textarea
          className="input mono textarea"
          rows={3}
          placeholder="0x…  (three hashes, whitespace separated, for a sandwich)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
        />

        {mode === 'self' && <ConnectGate {...write} />}

        <button
          className="btn"
          disabled={busy || hashes.length === 0 || !selected || (mode === 'self' && !write.canWrite)}
          onClick={run}
        >
          {busy ? 'working…' : mode === 'self' ? 'Build & sign' : 'Prosecute'}
        </button>

        <p className="dim small">
          {hashes.length === 3
            ? 'three hashes → IntraBlockExtraction (must be adjacent in one block)'
            : hashes.length === 1
              ? 'one hash → FailedTx'
              : 'attestation takes about eight minutes end to end; each step is narrated below'}
          {status && <span className="prosecute-status"> · {status}</span>}
        </p>

        {mode === 'self' && (
          <TxState status={write.status} hash={write.hash} error={write.error} confirmedLabel="verdict settled — bounty paid to you" />
        )}
      </section>

      <section>
        <span className="section-label">pipeline</span>
        {inFlight.map((c) => (
          <div key={c.id} className="pipeline-row">
            <span className="pulse" />
            <span className="mono small">{c.id}</span>
            <span className="dim small">{progress[c.id] ?? c.state.toLowerCase()}</span>
          </div>
        ))}
        {inFlight.length === 0 && <div className="dim small">Nothing in flight.</div>}
      </section>
    </>
  );
}
