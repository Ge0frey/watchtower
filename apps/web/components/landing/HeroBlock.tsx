'use client';

import { useEffect, useState } from 'react';

/**
 * The argument, as a technical drawing, before a word of explanation.
 *
 * Seven positions inside one Ethereum block, drawn the way a spec sheet would draw
 * them: leader lines, a caption, and the three that matter filled in. A front-run, a
 * victim, a back-run — at consecutive indices, in the same block, on a chain whose
 * contracts cannot look sideways at each other.
 *
 * A visitor who reads nothing else on this page has already seen the product. The
 * cells fill left to right on a loop rather than settling, because the point is that
 * this keeps happening.
 */

const CELLS = [
  { index: 27, role: 'idle' },
  { index: 28, role: 'idle' },
  { index: 29, role: 'searcher' },
  { index: 30, role: 'victim' },
  { index: 31, role: 'searcher' },
  { index: 32, role: 'idle' },
  { index: 33, role: 'idle' },
] as const;

export function HeroBlock() {
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    let n = 0;
    const tick = setInterval(() => {
      n = n >= CELLS.length + 3 ? 0 : n + 1;
      setFilled(n);
    }, 260);
    return () => clearInterval(tick);
  }, []);

  return (
    <figure className="relative isolate mx-auto w-full max-w-[860px] py-12 sm:py-28">
      <Orbits />

      <div className="relative z-10 grid grid-cols-5 items-end gap-x-1.5 sm:grid-cols-7 sm:gap-x-2">
        {/* ------------------------------------------------- leader, above */}
        <Leader className="col-start-2 sm:col-start-3" label="Front-run" sub="searcher buys" />
        <Leader className="col-start-4 sm:col-start-5" label="Back-run" sub="searcher sells" />

        {/* ----------------------------------------------------- the block */}
        {CELLS.map((cell, i) => {
          const on = i < filled;
          const edge = cell.index === 27 || cell.index === 33;
          return (
            <div key={cell.index} className={`row-start-2 ${edge ? 'hidden sm:block' : ''}`}>
              <div
                className={`flex aspect-square items-center justify-center rounded-md border font-mono text-[11px] transition-all duration-500 sm:text-[13px] ${
                  cell.role === 'searcher'
                    ? 'border-accent bg-accent text-ink'
                    : cell.role === 'victim'
                      ? 'border-ink bg-ink text-paper'
                      : 'border-ink/15 bg-card text-ink/25'
                } ${on || cell.role !== 'idle' ? 'opacity-100' : 'opacity-[0.2]'}`}
              >
                {cell.index}
              </div>
            </div>
          );
        })}

        {/* ------------------------------------------------- leader, below */}
        <Leader
          className="col-start-3 self-start sm:col-start-4"
          label="Your swap"
          sub="worse price"
          below
        />
      </div>

      <figcaption className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
        <span className="label text-ink/40">Ethereum mainnet</span>
        <span className="font-mono text-[12px] text-ink">block 25,955,190</span>
        <span className="h-3 w-px bg-ink/20" />
        <span className="label hidden text-ink/45 sm:block">
          three adjacent indices, one pool, round trip in profit
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * A callout with the hairline that connects it to its cell. Drawing the line is what
 * turns a coloured square into a labelled measurement.
 */
function Leader({
  label,
  sub,
  className = '',
  tone = 'ink',
  below = false,
}: {
  label: string;
  sub: string;
  className?: string;
  tone?: 'ink' | 'breach';
  below?: boolean;
}) {
  const text = tone === 'breach' ? 'text-breach' : 'text-ink';
  const line = tone === 'breach' ? 'bg-breach/40' : 'bg-ink/30';

  return (
    <div
      className={`flex flex-col items-center ${below ? 'row-start-3 pt-0' : 'row-start-1 pb-0'} ${className}`}
    >
      {below && <span className={`h-5 w-px sm:h-7 ${line}`} />}
      <span className={`label ${text} whitespace-nowrap`}>{label}</span>
      <span className="mt-1 hidden font-mono text-[10px] text-ink/35 sm:block">{sub}</span>
      {!below && <span className={`mt-2 h-5 w-px sm:h-7 ${line}`} />}
    </div>
  );
}

/**
/**
 * Three hairline ellipses at different tilts, turning slowly enough that you notice
 * them only after the type has landed. They carry no data — they are the one purely
 * graphic element in the product, and they earn their place by making a row of
 * squares read as an object rather than a chart.
 */
function Orbits() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 z-0 hidden aspect-square w-[108%] -translate-x-1/2 -translate-y-1/2 sm:block"
    >
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full animate-orbit">
        <ellipse
          cx="200"
          cy="200"
          rx="196"
          ry="92"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.9"
          className="text-ink/30"
          transform="rotate(24 200 200)"
        />
      </svg>

      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full animate-orbit-reverse">
        <ellipse
          cx="200"
          cy="200"
          rx="178"
          ry="128"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.9"
          className="text-ink/25"
          transform="rotate(-42 200 200)"
        />
      </svg>

      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
        <circle
          cx="200"
          cy="200"
          r="158"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.9"
          strokeDasharray="2 8"
          className="text-ink/18"
        />
      </svg>
    </div>
  );
}
