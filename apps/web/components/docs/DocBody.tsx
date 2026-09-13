import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Block, Tone } from '@/content/docs/schema';
import { headingId } from '@/content/docs/schema';
import { CodeBlock } from './CodeBlock';

/**
 * The typography of the documentation.
 *
 * Every rule the rest of the application follows holds here too: one grotesque
 * separated by weight and scale, mono for anything the chain produced, hairline
 * rules instead of boxes, and sage only where something is actually proven. The
 * measure is capped at ~74 characters because a documentation page that runs the
 * full width of a desktop is a page nobody finishes.
 */

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink',
  proven: 'text-accent-deep',
  breach: 'text-breach',
  pending: 'text-open',
  settled: 'text-settled',
};

/** The body measure. Tables, figures and listings are allowed to exceed it. */
const MEASURE = 'max-w-[74ch]';

export function DocBody({ blocks }: { blocks: Block[] }) {
  return (
    <div>
      {blocks.map((block, i) => (
        <DocBlock key={i} block={block} />
      ))}
    </div>
  );
}

function DocBlock({ block }: { block: Block }) {
  switch (block.kind) {
    /* ------------------------------------------------------------ headings */
    case 'h2':
      return (
        <h2
          id={headingId(block.text)}
          className="display mt-16 scroll-mt-44 text-[clamp(1.5rem,2.6vw,2rem)] first:mt-0"
        >
          {block.text}
        </h2>
      );

    case 'h3':
      return (
        <h3 className="mt-10 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink">
          {block.text}
        </h3>
      );

    /* --------------------------------------------------------------- prose */
    case 'p':
      return (
        <p className={`mt-5 ${MEASURE} text-[15.5px] leading-[1.75] text-ink/75`}>{block.children}</p>
      );

    case 'statement':
      return (
        <p
          className={`mt-10 mb-2 max-w-[54ch] text-[clamp(1.15rem,2vw,1.5rem)] leading-[1.5] tracking-[-0.012em] text-ink`}
        >
          {block.children}
        </p>
      );

    /* --------------------------------------------------------------- lists */
    case 'bullets':
      return (
        <ul className={`mt-6 ${MEASURE} space-y-3.5`}>
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-4 text-[15.5px] leading-[1.7] text-ink/75">
              <span aria-hidden className="mt-[0.62em] h-px w-3.5 shrink-0 bg-ink/35" />
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ul>
      );

    case 'steps':
      return (
        <ol className={`mt-6 ${MEASURE} space-y-4`}>
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-5 text-[15.5px] leading-[1.7] text-ink/75">
              <span className="label mt-[0.42em] shrink-0 text-ink/40">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ol>
      );

    case 'terms':
      return (
        <dl className="mt-7 border-t border-ink/12">
          {block.items.map((item, i) => (
            <div
              key={i}
              className="grid gap-2 border-b border-ink/10 py-5 md:grid-cols-[minmax(0,13rem)_1fr] md:gap-8"
            >
              <dt className="font-mono text-[12.5px] font-medium leading-relaxed text-ink">
                {item.term}
              </dt>
              <dd className="max-w-[62ch] text-[15px] leading-[1.7] text-ink/70">{item.body}</dd>
            </div>
          ))}
        </dl>
      );

    /* -------------------------------------------------------------- tables */
    case 'table':
      return (
        <div className="mt-7 overflow-x-auto rounded-lg border border-ink/12 bg-card">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-ink/12">
                {block.head.map((cell, i) => (
                  <th key={i} className="label px-5 py-3.5 align-bottom text-ink/50">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-b border-ink/8 last:border-b-0 align-top">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`px-5 py-4 text-[14px] leading-[1.6] ${
                        j === 0 ? 'font-medium text-ink' : 'text-ink/70'
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    /* ------------------------------------------------------------ listings */
    case 'code':
      return <CodeBlock code={block.code} caption={block.caption} />;

    /* -------------------------------------------------------------- notice */
    case 'note': {
      const tone = block.tone ?? 'pending';
      return (
        <aside className="mt-7 max-w-[76ch] rounded-lg border border-ink/12 bg-card px-6 py-5">
          {block.title && (
            <p className={`label mb-2.5 ${tone === 'neutral' ? 'text-ink/50' : TONE_TEXT[tone]}`}>
              {block.title}
            </p>
          )}
          <div className="text-[14.5px] leading-[1.7] text-ink/70">{block.children}</div>
        </aside>
      );
    }

    /* ------------------------------------------------------------- figures */
    case 'figure':
      return (
        <figure className={`mt-9 ${block.wide ? '' : MEASURE}`}>
          {/*
            A tall diagram is capped rather than stretched: at full desktop width a
            1212x3749 flowchart becomes three screens of scroll for the same
            information. The plate opens the original in a tab, which is the right
            place to read one at full size.
          */}
          <a
            href={block.src}
            target="_blank"
            rel="noreferrer"
            className="group block overflow-hidden rounded-lg border border-ink/12 bg-card p-4 transition-colors hover:border-accent md:p-6"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={block.src}
              alt={block.alt}
              className={`mx-auto block h-auto w-full ${block.wide ? 'max-w-[44rem]' : ''}`}
            />
          </a>
          <figcaption className="mt-4 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
            {block.caption && (
              <span className="max-w-[62ch] text-[13.5px] leading-relaxed text-ink/50">
                {block.caption}
              </span>
            )}
            <a
              href={block.src}
              target="_blank"
              rel="noreferrer"
              className="label shrink-0 text-ink/45 transition-colors hover:text-accent-deep"
            >
              Open full size ↗
            </a>
          </figcaption>
        </figure>
      );

    case 'figures':
      return (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {block.items.map((item, i) => (
            <div key={i} className="rounded-lg border border-ink/12 bg-card p-6">
              <p className="label mb-5 text-ink/50">{item.label}</p>
              <p
                className={`font-mono text-[26px] leading-[0.95] tracking-tight ${
                  TONE_TEXT[item.tone ?? 'neutral']
                }`}
              >
                {item.value}
              </p>
              {item.sub && (
                <p className="mt-3 font-mono text-[11px] leading-snug text-ink/40">{item.sub}</p>
              )}
            </div>
          ))}
        </div>
      );

    /* --------------------------------------------------------------- cards */
    case 'cards':
      return (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {block.items.map((item, i) => <DocCard key={i} {...item} />)}
        </div>
      );

    case 'divider':
      return <hr className="mt-14 border-0 border-t border-ink/12" />;
  }
}

function DocCard({
  href,
  title,
  body,
  external,
}: {
  href: string;
  title: string;
  body: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <p className="text-[15px] font-semibold leading-snug text-ink">
        {title}
        <span className="ml-1.5 inline-block text-ink/40 transition-transform duration-200 group-hover:translate-x-1">
          {external ? '↗' : '→'}
        </span>
      </p>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink/55">{body}</p>
    </>
  );

  const shell =
    'group block rounded-lg border border-ink/12 bg-card px-6 py-5 transition-colors hover:border-accent';

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={shell}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={shell}>
      {inner}
    </Link>
  );
}

/* ------------------------------------------------------------------ inline
 *
 * The three inline marks content is allowed to use. They live here rather than in
 * each page so a contract name is set the same way on every one of them. */

/** Anything the chain produced, or anything you would type into a shell. */
export function C({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-sm bg-paper-dim px-1.5 py-0.5 font-mono text-[0.86em] text-ink">
      {children}
    </code>
  );
}

/** A link to somewhere else in the documentation, or in the application. */
export function A({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith('http');
  const className =
    'font-medium text-ink underline decoration-accent decoration-2 underline-offset-[3px] transition-colors hover:text-accent-deep';

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/** Emphasis that is making a claim rather than raising its voice. */
export function S({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}
