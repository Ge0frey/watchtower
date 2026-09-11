'use client';

import { useEffect, useState } from 'react';

export type CellRole = 'attacker' | 'victim' | 'entry' | 'cursor' | 'gap' | 'idle';

export interface Cell {
  index: number;
  role: CellRole;
  blockHeight?: number;
}

const ROLE: Record<CellRole, { box: string; key: string; label: string }> = {
  attacker: { box: 'border-accent bg-accent text-ink', key: 'text-accent-deep', label: 'searcher' },
  victim: { box: 'border-ink bg-ink text-paper', key: 'text-ink', label: 'victim' },
  entry: { box: 'border-accent bg-accent text-ink', key: 'text-accent-deep', label: 'proven entry' },
  cursor: { box: 'border-ink/40 bg-ink/40 text-paper', key: 'text-ink/55', label: 'cursor' },
  gap: { box: 'border-breach border-dashed bg-transparent text-breach', key: 'text-breach', label: 'skipped' },
  idle: { box: 'border-ink/15 bg-paper-dim text-ink/30', key: 'text-ink/35', label: 'untouched' },
};

/**
 * The hero visual, and the only one this application needs.
 *
 * It renders the evidence coordinate `(blockHeight, txIndex)` — the fact an Ethereum
 * contract cannot observe about its own neighbours. An intra-block incident lights
 * three adjacent cells in one block with the surrounding positions dimmed, which is
 * the whole argument in one picture: those transactions were *right there*, in the
 * same block, and the chain they ran on could not see them together.
 *
 * A stream incident lights a run across blocks with the cursor marked and any
 * challenged gap punched out. One visual language, every failure mode.
 */
export function BlockStrip({
  cells,
  blockHeight,
  mode,
  animate = true,
  size = 'md',
}: {
  cells: Cell[];
  blockHeight?: number;
  mode: 'intra-block' | 'stream';
  animate?: boolean;
  size?: 'sm' | 'md';
}) {
  const [revealed, setRevealed] = useState(animate ? 0 : cells.length);

  // Keyed on what the cells ARE, not on the array's identity. `cells` is rebuilt on
  // every render and the chain poll re-renders this component every three seconds —
  // depending on the array would restart the reveal forever, which is exactly the
  // kind of idle motion this design system does not permit.
  const signature = cells.map((c) => `${c.blockHeight ?? ''}:${c.index}:${c.role}`).join(',');

  useEffect(() => {
    const count = signature ? signature.split(',').length : 0;
    if (!animate) return setRevealed(count);
    setRevealed(0);
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      setRevealed(n);
      if (n >= count) clearInterval(timer);
    }, 60);
    return () => clearInterval(timer);
  }, [signature, animate]);

  // Fixed squares, never stretched. A block index is a position, and three of them
  // spread across a full-width card would read as three bars rather than three
  // neighbours sitting next to each other.
  const cellSize = size === 'sm' ? 'h-10 w-10 text-[10px]' : 'h-14 w-14 text-[12px] md:h-16 md:w-16';

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {cells.map((cell, i) => {
          const style = ROLE[cell.role];
          const visible = i < revealed;
          return (
            <div
              key={`${cell.blockHeight ?? blockHeight}-${cell.index}-${i}`}
              title={`${cell.blockHeight ? `block ${cell.blockHeight.toLocaleString()} · ` : ''}index ${cell.index} — ${style.label}`}
              style={{ animationDelay: `${i * 45}ms` }}
              className={`flex ${cellSize} shrink-0 items-center justify-center rounded-md border font-mono ${style.box} ${
                visible ? 'animate-cell-in' : 'opacity-[0.08]'
              }`}
            >
              {cell.index}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="label text-ink/45">
          {mode === 'intra-block' && blockHeight
            ? `Block ${blockHeight.toLocaleString()} · consecutive transaction indices`
            : 'Proven entries across blocks · cursor marked, gaps punched out'}
        </p>
        <Legend cells={cells} />
      </div>
    </div>
  );
}

/**
 * Only name the roles that are actually on screen, and name them in their own
 * colour. A swatch beside a word is a second object saying what the word already
 * says once the word is set in the colour it refers to.
 */
function Legend({ cells }: { cells: Cell[] }) {
  const roles = [...new Set(cells.map((c) => c.role))].filter((r) => r !== 'idle');
  if (roles.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {roles.map((role) => (
        <span key={role} className={`label ${ROLE[role].key}`}>
          {ROLE[role].label}
        </span>
      ))}
    </div>
  );
}

/** Three adjacent positions, padded with the untouched neighbours on either side. */
export function sandwichCells(firstIndex: number, pad = 3): Cell[] {
  const cells: Cell[] = [];
  for (let i = Math.max(0, firstIndex - pad); i < firstIndex; i++) cells.push({ index: i, role: 'idle' });
  cells.push({ index: firstIndex, role: 'attacker' });
  cells.push({ index: firstIndex + 1, role: 'victim' });
  cells.push({ index: firstIndex + 2, role: 'attacker' });
  for (let i = firstIndex + 3; i < firstIndex + 3 + pad; i++) cells.push({ index: i, role: 'idle' });
  return cells;
}

/** A run of proven entries, optionally with one coordinate shown as a skipped gap. */
export function streamCells(
  entries: { blockHeight: number; txIndex: number }[],
  gap?: { blockHeight: number; txIndex: number },
): Cell[] {
  const cells: Cell[] = entries.map((e) => ({ index: e.txIndex, role: 'entry', blockHeight: e.blockHeight }));
  if (gap) {
    cells.push({ index: gap.txIndex, role: 'gap', blockHeight: gap.blockHeight });
    cells.sort((a, b) => (a.blockHeight ?? 0) - (b.blockHeight ?? 0) || a.index - b.index);
  }
  return cells;
}
