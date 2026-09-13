import type { DocPage, DocSection } from './schema';
import { gettingStarted } from './pages/getting-started';
import { concepts } from './pages/concepts';
import { using } from './pages/using';
import { program } from './pages/program';
import { prosecutor } from './pages/prosecutor';
import { operations } from './pages/operations';
import { reference } from './pages/reference';

/**
 * The documentation, in reading order.
 *
 * The order is the argument: what it is, what the words mean, what you do, how it
 * is built, how to run it, and then the things you look up rather than read. A
 * reader who starts at the top and does not stop should finish able to explain the
 * system to someone else.
 */
export const SECTIONS: DocSection[] = [
  gettingStarted,
  concepts,
  using,
  program,
  prosecutor,
  operations,
  reference,
];

export interface ResolvedPage {
  page: DocPage;
  section: DocSection;
}

/** Flattened once at module scope — the tree is static, so nothing here needs memoising. */
const FLAT: ResolvedPage[] = SECTIONS.flatMap((section) =>
  section.pages.map((page) => ({ page, section })),
);

export const hrefOf = (page: DocPage) => (page.slug ? `/docs/${page.slug}` : '/docs');

export const allPages = () => FLAT;

export function findPage(slug: string): ResolvedPage | undefined {
  return FLAT.find((entry) => entry.page.slug === slug);
}

/** The previous and next page in reading order, across section boundaries. */
export function neighbours(slug: string): { prev?: ResolvedPage; next?: ResolvedPage } {
  const i = FLAT.findIndex((entry) => entry.page.slug === slug);
  if (i === -1) return {};
  return { prev: FLAT[i - 1], next: FLAT[i + 1] };
}

/** The serialisable shape the client-side sidebar takes. */
export function navTree() {
  return SECTIONS.map((section) => ({
    title: section.title,
    pages: section.pages.map((page) => ({
      href: hrefOf(page),
      title: page.title,
      lede: page.lede,
      keywords: page.keywords ?? [],
    })),
  }));
}
