'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';

export interface NavPage {
  href: string;
  title: string;
  lede: string;
  keywords: string[];
}

export interface NavSection {
  title: string;
  pages: NavPage[];
}

/**
 * The contents.
 *
 * Sections are set as marginalia and the pages under them as ordinary type, which
 * is the same relationship every panel header in the application has to its body —
 * so the rail reads as part of the document rather than as a control panel bolted
 * to its left edge.
 *
 * The filter matches the title, the one-line lede *and* a page's keywords, because
 * the word someone types is usually the thing they are stuck on — `mixHash`,
 * `EROFS`, `calculateTxIndex` — and not the title of the page that explains it.
 *
 * The active page is a sage wash rather than a rule or a dot: it is the one place
 * in the rail where colour is doing work, and a filled wash reads at a glance from
 * across a list of thirty items where a 2px bar does not.
 */
export function DocsSidebar({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;

    return sections
      .map((section) => ({
        title: section.title,
        pages: section.pages.filter((page) =>
          [page.title, page.lede, section.title, ...page.keywords]
            .join(' ')
            .toLowerCase()
            .includes(q),
        ),
      }))
      .filter((section) => section.pages.length > 0);
  }, [sections, query]);

  const current = sections.flatMap((s) => s.pages).find((p) => p.href === pathname);

  return (
    <>
      {/* ------------------------------------------ small screens: a disclosure */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 rounded-lg border border-ink/12 bg-card px-5 py-3.5 text-left lg:hidden"
      >
        <span className="min-w-0">
          <span className="label block text-ink/45">Documentation</span>
          <span className="mt-1 block truncate text-[14px] font-medium text-ink">
            {current?.title ?? 'Contents'}
          </span>
        </span>
        <span
          aria-hidden
          className={`shrink-0 font-mono text-[11px] text-ink/50 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        >
          ▾
        </span>
      </button>

      <nav
        className={`mt-4 lg:mt-0 lg:block ${open ? 'block' : 'hidden'}`}
        aria-label="Documentation"
      >
        <div className="rounded-lg border border-ink/12 bg-card p-4 lg:border-0 lg:bg-transparent lg:p-0">
          {/* --------------------------------------------------------- filter */}
          <label className="relative block">
            <span className="sr-only">Filter pages</span>
            <span
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-[12px] text-ink/35"
            >
              ⌕
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter pages…"
              className="w-full rounded-md border border-ink/15 bg-paper py-2.5 pl-9 pr-3 font-mono text-[12px] text-ink placeholder:text-ink/35 transition-colors focus:border-accent focus:bg-card focus:outline-none"
            />
          </label>

          {/* ---------------------------------------------------------- pages */}
          <div className="mt-7 space-y-8 lg:max-h-[calc(100vh-15rem)] lg:overflow-y-auto lg:pr-2">
            {filtered.map((section) => (
              <div key={section.title}>
                <p className="label mb-3 px-3 text-ink/45">{section.title}</p>
                <ul className="space-y-px">
                  {section.pages.map((page) => {
                    const active = pathname === page.href;
                    return (
                      <li key={page.href}>
                        <Link
                          href={page.href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className={`block rounded-md px-3 py-2 text-[14px] leading-snug transition-colors ${
                            active
                              ? 'bg-wash-proven font-semibold text-ink'
                              : 'text-ink/65 hover:bg-paper-dim hover:text-ink'
                          }`}
                        >
                          {page.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            {filtered.length === 0 && (
              <p className="px-3 text-[13.5px] leading-relaxed text-ink/45">
                Nothing matches “{query.trim()}”.
              </p>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
