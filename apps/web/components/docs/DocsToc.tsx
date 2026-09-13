'use client';

import { useEffect, useState } from 'react';
import type { TocEntry } from '@/content/docs/schema';

/**
 * On this page.
 *
 * The active heading is found with an IntersectionObserver against a band across
 * the upper third of the viewport rather than by measuring scroll offsets on every
 * frame: the answer is the same and the browser does the work off the main thread.
 * The marker is a solid ink bar in the gutter — the same hairline-and-weight
 * vocabulary as everything else, and the one thing in the rail that moves.
 *
 * Nothing here animates on a timer. The bar moves when the reader does.
 */
export function DocsToc({ entries }: { entries: TocEntry[] }) {
  const [active, setActive] = useState<string | null>(entries[0]?.id ?? null);

  useEffect(() => {
    if (entries.length === 0) return;

    const seen = new Map<string, boolean>();

    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) seen.set(record.target.id, record.isIntersecting);

        // The first heading currently inside the band wins. Falling back to the last
        // one above it keeps a long section selected while the reader is in the
        // middle of it, rather than clearing the marker between headings.
        const visible = entries.find((entry) => seen.get(entry.id));
        if (visible) setActive(visible.id);
      },
      // Top of the band sits under the sticky chrome; the bottom cuts the viewport
      // at a third, so a heading is "current" from when it lands, not when it leaves.
      { rootMargin: '-180px 0px -67% 0px', threshold: 0 },
    );

    for (const entry of entries) {
      const node = document.getElementById(entry.id);
      if (node) observer.observe(node);
    }

    return () => observer.disconnect();
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <nav aria-label="On this page">
      <p className="label mb-4 text-ink/45">On this page</p>
      <ul className="space-y-px border-l border-ink/12">
        {entries.map((entry) => {
          const current = entry.id === active;
          return (
            <li key={entry.id}>
              <a
                href={`#${entry.id}`}
                aria-current={current ? 'location' : undefined}
                className={`-ml-px block border-l-2 py-1.5 pl-4 text-[13px] leading-snug transition-colors ${
                  current
                    ? 'border-ink font-semibold text-ink'
                    : 'border-transparent text-ink/50 hover:border-ink/30 hover:text-ink'
                }`}
              >
                {entry.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
