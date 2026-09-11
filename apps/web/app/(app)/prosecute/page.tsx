'use client';

import { useState } from 'react';
import { RULES, formatCtc, watchtowerCoreAbi } from '@watchtower/shared';
import { rehydrate } from '@/components/actions/ChallengePanel';
import { ConnectGate, TxState } from '@/components/actions/TxButton';
import { Button, Empty, Label, Notice, PageHead, Section, Select, Textarea } from '@/components/ui';
import { CORE, useChainState } from '@/hooks/useChainState';
import { useIncidentFeed } from '@/hooks/useIncidentFeed';
import { useWatchtowerWrite } from '@/hooks/useWatchtowerWrite';
import { useWorkerStatus } from '@/hooks/useWorkerStatus';
import { api } from '@/lib/api';

type Mode = 'relayed' | 'self';

/**
 * The prosecutor console.
 *
 * Two doors to the same verdict. **Relayed**: the worker builds the proof, pays the
 * gas, and takes the bounty — so anyone can try this without holding CTC. **Self**:
 * the worker returns ready-to-sign calldata, your wallet submits it, and the bounty
 * is yours.
 *
 * Neither door can forge anything. The worker only assembles proofs; the Attestcoin
 * Smart Contract re-verifies every one inside the transaction that settles, so a
 * dishonest submission reverts rather than paying.
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
  const { offline } = useWorkerStatus();

  const hashes = value
    .split(/[\s,]+/)
    .map((h) => h.trim())
    .filter((h) => /^0x[0-9a-fA-F]{64}$/.test(h));

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

  const reading =
    hashes.length === 3
      ? 'three hashes → IntraBlockExtraction · must be adjacent in one block'
      : hashes.length === 1
        ? 'one hash → FailedTx · must have reverted'
        : 'paste one hash for a failed transaction, or three for a sandwich';

  return (
    <>
      <PageHead
        eyebrow="Permissionless"
        title="Prosecute"
        lede="Paste an Ethereum transaction and get a verdict. Three hashes from one block are read as a sandwich; a single hash is read as a failed transaction."
      />

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <Section
          title="File evidence"
          bodyClassName="space-y-8 p-7"
          aside={
            <div className="flex overflow-hidden rounded-md border border-ink/20">
              {(['relayed', 'self'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`border-r border-ink/20 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors last:border-r-0 ${
                    mode === m ? 'bg-ink text-paper' : 'text-ink/60 hover:text-ink'
                  }`}
                >
                  {m === 'relayed' ? 'Relayed' : 'Sign it myself'}
                </button>
              ))}
            </div>
          }
        >
          <p className="max-w-[62ch] text-[14px] leading-relaxed text-ink/55">
            {mode === 'relayed'
              ? 'The worker builds the proof, pays the gas, and takes the bounty. No wallet needed.'
              : `The worker returns calldata; your wallet submits it and the bounty is yours${
                  selected ? ` — pool currently ${formatCtc(selected.bountyPool, 3)}` : ''
                }.`}
          </p>

          <div>
            <Label className="mb-2.5 block">Subject</Label>
            <Select value={selected?.id ?? ''} onChange={(e) => setSubjectId(e.target.value)}>
              {insurable.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label className="mb-2.5 block">Ethereum transaction hashes</Label>
            <Textarea
              rows={3}
              placeholder="0x…  (three hashes, whitespace separated, for a sandwich)"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              spellCheck={false}
            />
            <p className="mt-3 font-mono text-[11.5px] text-ink/50">{reading}</p>
          </div>

          {mode === 'self' && <ConnectGate {...write} />}

          {offline && (
            <Notice>
              The worker is offline. Both modes need it &mdash; it is what talks to the Attestcoin
              Proof Builder. Your wallet signs the result, but it cannot build a proof on its own.
            </Notice>
          )}

          <div className="flex flex-wrap items-center gap-5">
            <Button
              disabled={busy || offline || hashes.length === 0 || !selected || (mode === 'self' && !write.canWrite)}
              onClick={run}
            >
              {busy ? 'working…' : mode === 'self' ? 'Build & sign' : 'Prosecute'}
            </Button>
            {status && <span className="font-mono text-[11.5px] text-accent-deep">{status}</span>}
          </div>

          {mode === 'self' && (
            <TxState
              status={write.status}
              hash={write.hash}
              error={write.error}
              confirmedLabel="verdict settled — bounty paid to you"
            />
          )}
        </Section>

        <div className="space-y-10">
          <Section
            title="Pipeline"
            aside={<span className="label text-ink/50">live</span>}
          >
            {inFlight.length === 0 ? (
              <p className="text-[14px] text-ink/50">Nothing in flight.</p>
            ) : (
              <div className="space-y-4">
                {inFlight.map((c) => (
                  <div key={c.id} className="border border-dashed border-ink/25 px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11.5px]">{c.id}</span>
                    </div>
                    <p className="mt-2 font-mono text-[11.5px] leading-relaxed text-ink/45">
                      {progress[c.id] ?? c.state.toLowerCase()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="What happens next">
            <ol className="space-y-4">
              {[
                'the worker waits for the block to be attested (~8 min)',
                'it builds a Merkle + continuity proof through the SDK',
                'it verifies read-only against the precompile — no gas',
                'WatchtowerCore re-verifies inside the settling transaction',
                'the rule judges; the vault pays',
              ].map((step, i) => (
                <li key={i} className="flex gap-4 font-mono text-[12px] leading-relaxed text-ink/55">
                  <span className="shrink-0 text-ink/30">{String(i + 1).padStart(2, '0')}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-8 border-t border-ink/10 pt-6 text-[13px] leading-relaxed text-ink/50">
              A dishonest submission cannot produce a payout. It reverts at step four.
            </p>
          </Section>
        </div>
      </div>

      {inFlight.length === 0 && candidates.length === 0 && !offline && (
        <div className="mt-12">
          <Empty title="No candidates detected yet">
            The worker is scanning Ethereum for the shapes its rules can judge. Anything it finds
            appears here and on the incidents page.
          </Empty>
        </div>
      )}
    </>
  );
}
