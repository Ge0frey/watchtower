'use client';

import { useEffect, useRef, useState } from 'react';
import { Label } from '@/components/ui';
import { useWorkerStatus } from '@/hooks/useWorkerStatus';

/**
 * The cold start, told honestly.
 *
 * The worker is hosted on a free container that sleeps when nobody is looking, so the first visit
 * after an idle period waits twice: once for the process to boot and pass its Creditcoin checks
 * before the API binds, and again for the scanners to sweep up to the attested head. Neither wait is
 * a fault, and hiding them behind a spinner would misreport a working system as a hanging one.
 *
 * So this narrates them with the worker's own numbers - chain id, attested heads, blocks behind per
 * subject, all read straight off `/api/health`. The copy above them is light; the figures under it
 * are real, and they are the part a reader can check. A fake percentage bar would be the one thing
 * on this screen that could be caught out.
 *
 * The system's standing rule is that nothing blinks, pulses or breathes - the only motion permitted
 * is evidence arriving, once. The celebration obeys it rather than breaking it: the worker coming
 * live *is* an arrival, and it fires exactly once per session.
 */

/** How long between lines of copy. Long enough to read, short enough not to feel stuck. */
const COPY_MS = 5_500;

/** How long the celebration holds before the panel gets out of the way. */
const CELEBRATE_MS = 4_500;

const BOOTING_COPY = [
  'Waking the prosecutor. It sleeps when nobody is watching.',
  'Confirming it is really Creditcoin on the other end.',
  'Still going — free tier, cutie pie. It naps between demos.',
  'Almost. The proofs do not build themselves.',
];

const CATCHING_UP_COPY = [
  'Sweeping Ethereum for things that already happened.',
  'Ten blocks a query. The free RPC tier asks for patience.',
  'Nearly at the head.',
];

/**
 * One burst, once a session, never for a reader who asked not to be moved.
 *
 * Loaded on demand so a library that fires at most once per visit is not in the bundle every visit.
 * `sessionStorage` throws outright in some privacy modes, so every touch of it is guarded - a
 * celebration is not worth a blank screen.
 */
async function celebrate() {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (sessionStorage.getItem('wt:worker-live') === '1') return;
    sessionStorage.setItem('wt:worker-live', '1');
  } catch {
    return;
  }

  const { default: confetti } = await import('canvas-confetti');
  // Sage is the system's one accent and it means proven; the greens beside it mean settled. The
  // burst is in the palette's own vocabulary rather than in party colours.
  const colors = ['#7d8f6a', '#556047', '#0f7346', '#101010'];
  confetti({ particleCount: 70, spread: 64, origin: { y: 0.28 }, colors, scalar: 0.85, ticks: 160 });
  confetti({ particleCount: 34, spread: 96, origin: { y: 0.3 }, colors, scalar: 0.7, ticks: 140 });
}

export function WorkerWarmup() {
  const { phase, lag, health } = useWorkerStatus();

  const warming = phase === 'booting' || phase === 'catching-up';

  const sawWarming = useRef(false);
  const baseline = useRef<number | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [copyIndex, setCopyIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // The largest lag seen at the start of catch-up, so the bar below is measured against where this
  // actually began rather than against an arbitrary ceiling.
  if (phase === 'catching-up' && (baseline.current === null || lag > baseline.current)) {
    baseline.current = lag;
  }

  useEffect(() => {
    if (warming) sawWarming.current = true;
  }, [warming]);

  useEffect(() => {
    if (!warming) return;
    const copy = setInterval(() => setCopyIndex((i) => i + 1), COPY_MS);
    const tick = setInterval(() => setElapsed((s) => s + 1), 1_000);
    return () => {
      clearInterval(copy);
      clearInterval(tick);
    };
  }, [warming]);

  useEffect(() => {
    if (phase !== 'live' || !sawWarming.current) return;
    sawWarming.current = false;
    baseline.current = null;
    setElapsed(0);
    setCelebrating(true);
    void celebrate();
    const done = setTimeout(() => setCelebrating(false), CELEBRATE_MS);
    return () => clearTimeout(done);
  }, [phase]);

  if (celebrating) {
    return (
      <div className="animate-rise mb-10 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-accent/40 bg-card px-5 py-4">
        <Label tone="proven">Worker live</Label>
        <span className="text-[13.5px] text-ink/65">
          Prosecutor is up and caught up. Every proof it builds from here is checkable. 🎉
        </span>
      </div>
    );
  }

  if (!warming) return null;

  const booting = phase === 'booting';
  const lines = booting ? BOOTING_COPY : CATCHING_UP_COPY;
  const line = lines[copyIndex % lines.length];

  const start = baseline.current;
  const swept = start && start > lag ? start - lag : 0;
  const percent = start && start > 0 ? Math.min(99, Math.round((swept / start) * 100)) : null;

  return (
    <section className="animate-rise mb-10 rounded-lg border border-ink/12 bg-card">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-ink/10 px-6 py-4">
        <Label>{booting ? 'Prosecutor starting' : 'Prosecutor catching up'}</Label>
        <span className="font-mono text-[11px] text-ink/40">
          {elapsed}s{percent !== null && ` · ${percent}%`}
        </span>
      </header>

      <div className="px-6 py-6">
        <p className="max-w-[60ch] text-[14px] leading-relaxed text-ink/65">{line}</p>

        <p className="mt-3 max-w-[64ch] text-[13px] leading-relaxed text-ink/45">
          Creditcoin is answering the browser directly, so subjects, the vault and every wallet
          action work right now. What is still arriving is history and the ability to build a proof.
        </p>

        {/* Measured against the lag this began at. When there is no baseline yet there is no bar -
            an indeterminate bar pretending to be determinate is the lie this panel exists to avoid. */}
        {percent !== null && (
          <div className="mt-6 h-[3px] w-full overflow-hidden rounded-sm bg-ink/10">
            <div
              className="h-full rounded-sm bg-accent transition-[width] duration-700 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}

        <Facts health={health} lag={lag} booting={booting} />
      </div>
    </section>
  );
}

/**
 * The checkable half.
 *
 * Everything here came off `/api/health`, which is why it is all mono. While the worker is still
 * booting there is nothing to report but the attempt itself, and saying so is better than filling
 * the space with zeroes.
 */
function Facts({
  health,
  lag,
  booting,
}: {
  health: ReturnType<typeof useWorkerStatus>['health'];
  lag: number;
  booting: boolean;
}) {
  if (booting || !health) {
    return (
      <p className="mt-6 border-t border-ink/10 pt-4 font-mono text-[11px] text-ink/40">
        waiting on /api/health — the worker checks Creditcoin and the precompile before it listens
      </p>
    );
  }

  const cursors = Object.entries(health.cursorLag ?? {});

  return (
    <dl className="mt-6 space-y-1.5 border-t border-ink/10 pt-4 font-mono text-[11px]">
      <Fact term="chain" detail={`${health.chainId}`} />
      {Object.entries(health.attestedHeads ?? {}).map(([key, head]) => (
        <Fact
          key={key}
          term={key === '1' ? 'sepolia head' : key === '3' ? 'mainnet head' : `chainKey ${key}`}
          detail={head.toLocaleString()}
        />
      ))}
      {cursors.map(([label, behind]) => (
        <Fact key={label} term={label} detail={`${behind.toLocaleString()} behind`} />
      ))}
      {cursors.length === 0 && <Fact term="cursors" detail={`${lag.toLocaleString()} behind`} />}
    </dl>
  );
}

function Fact({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink/40">{term}</dt>
      <dd className="text-ink/70">{detail}</dd>
    </div>
  );
}
