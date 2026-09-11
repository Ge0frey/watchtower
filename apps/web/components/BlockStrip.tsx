'use client';

import { useEffect, useState } from 'react';

export type CellRole = 'attacker' | 'victim' | 'entry' | 'cursor' | 'gap' | 'idle';

export interface Cell {
  index: number;
  role: CellRole;
  blockHeight?: number;
}

const ROLE_STYLE: Record<CellRole, { fill: string; label: string }> = {
  attacker: { fill: 'var(--amber)', label: 'searcher' },
  victim: { fill: 'var(--red)', label: 'victim' },
  entry: { fill: 'var(--blue)', label: 'proven entry' },
  cursor: { fill: 'var(--green)', label: 'cursor' },
  gap: { fill: 'transparent', label: 'skipped' },
  idle: { fill: 'var(--slate)', label: 'untouched' },
};

/**
 * The hero visual, and the only one the dashboard needs.
 *
 * It renders the evidence coordinate `(blockHeight, txIndex)` - the fact an Ethereum contract cannot
 * observe about its own neighbours. An intra-block incident lights three adjacent cells in one block,
 * with the surrounding positions dimmed to show they were right there and untouched. A stream
 * incident lights a run across blocks, with the cursor marked and any challenged gap punched out.
 *
 * One visual language, every failure mode.
 */
export function BlockStrip({
  cells,
  blockHeight,
  mode,
  animate = true,
}: {
  cells: Cell[];
  blockHeight?: number;
  mode: 'intra-block' | 'stream';
  animate?: boolean;
}) {
  const [revealed, setRevealed] = useState(animate ? 0 : cells.length);

  useEffect(() => {
    if (!animate) return setRevealed(cells.length);
    setRevealed(0);
    const highlights = cells.filter((c) => c.role !== 'idle').length;
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      setRevealed(n);
      if (n >= highlights) clearInterval(timer);
    }, 140);
    return () => clearInterval(timer);
  }, [cells, animate]);

  let shown = 0;

  return (
    <div className="strip">
      <div className="strip-row">
        {cells.map((cell, i) => {
          const style = ROLE_STYLE[cell.role];
          const isHighlight = cell.role !== 'idle';
          if (isHighlight) shown += 1;
          const visible = !isHighlight || shown <= revealed;

          return (
            <div
              key={`${cell.blockHeight ?? blockHeight}-${cell.index}-${i}`}
              className={`cell ${cell.role} ${visible ? 'on' : 'off'}`}
              style={{ background: visible ? style.fill : 'var(--slate)' }}
              title={`${cell.blockHeight ? `block ${cell.blockHeight.toLocaleString()} · ` : ''}index ${cell.index} — ${style.label}`}
            >
              <span className="cell-index">{cell.index}</span>
            </div>
          );
        })}
      </div>
      <div className="strip-caption">
        {mode === 'intra-block' && blockHeight
          ? `block ${blockHeight.toLocaleString()} — consecutive transaction indices`
          : 'proven entries across blocks — cursor marked, gaps punched out'}
      </div>
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
