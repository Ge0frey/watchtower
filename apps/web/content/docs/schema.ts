import type { ReactNode } from 'react';

/**
 * The documentation is content-as-data, not prose-as-markup.
 *
 * Every page is an array of blocks, and a block is one of a closed set of shapes.
 * Two things fall out of that, and both are the reason it is not MDX:
 *
 *  1. The table of contents is *derived*. `h2` blocks are the only source of a
 *     heading, so "On this page" cannot drift from the page — there is no second
 *     list to keep in sync and no runtime DOM scrape to get it.
 *  2. There is exactly one way to set a table, a code listing, a note and a term
 *     list, so a page written today matches a page written six months ago. A
 *     markdown pipeline hands that discipline back to whoever is typing.
 *
 * The blocks themselves are rendered by `components/docs/DocBody.tsx`, which is
 * where the typography lives. Nothing here knows a colour or a font size.
 */

export type Tone = 'neutral' | 'proven' | 'breach' | 'pending' | 'settled';

export type Block =
  /** A section heading. The only thing that reaches the table of contents. */
  | { kind: 'h2'; text: string }
  /** A subheading inside a section. Deliberately not in the contents — three
   *  levels of navigation for a page this size is a list, not a map. */
  | { kind: 'h3'; text: string }
  | { kind: 'p'; children: ReactNode }
  /** One sentence set larger, for the claim a section turns on. */
  | { kind: 'statement'; children: ReactNode }
  | { kind: 'note'; tone?: Tone; title?: string; children: ReactNode }
  /** A listing on an ink ground. `caption` names what it is; the copy button is free. */
  | { kind: 'code'; caption?: string; code: string }
  | { kind: 'table'; head: string[]; rows: ReactNode[][] }
  | { kind: 'bullets'; items: ReactNode[] }
  | { kind: 'steps'; items: ReactNode[] }
  /** Term on the left, definition on the right. The default for a vocabulary. */
  | { kind: 'terms'; items: { term: string; body: ReactNode }[] }
  /** A figure with its own caption. `wide` lets it break the measure. */
  | { kind: 'figure'; src: string; alt: string; caption?: ReactNode; wide?: boolean }
  /** A row of links out — to another page here, or to the chain. */
  | { kind: 'cards'; items: { href: string; title: string; body: string; external?: boolean }[] }
  /** A labelled pair of numbers, for a measurement worth stopping on. */
  | { kind: 'figures'; items: { label: string; value: string; sub?: string; tone?: Tone }[] }
  | { kind: 'divider' };

export interface DocPage {
  /** The path under `/docs`. The empty string is `/docs` itself. */
  slug: string;
  title: string;
  /** One sentence under the title. Also the sidebar filter's second haystack. */
  lede: string;
  blocks: Block[];
  /** Extra words the filter should match — names, commands, error strings. */
  keywords?: string[];
}

export interface DocSection {
  title: string;
  pages: DocPage[];
}

/** A heading's anchor. Shared by the renderer and the contents so they cannot disagree. */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface TocEntry {
  id: string;
  text: string;
}

export function tocOf(page: DocPage): TocEntry[] {
  return page.blocks
    .filter((b): b is Extract<Block, { kind: 'h2' }> => b.kind === 'h2')
    .map((b) => ({ id: headingId(b.text), text: b.text }));
}
