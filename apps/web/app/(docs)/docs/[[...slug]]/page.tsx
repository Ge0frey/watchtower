import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DocBody } from '@/components/docs/DocBody';
import { DocsToc } from '@/components/docs/DocsToc';
import { allPages, findPage, hrefOf, neighbours } from '@/content/docs';
import { tocOf } from '@/content/docs/schema';

/**
 * One route for the whole documentation.
 *
 * A catch-all rather than a file per page: the content is data, so a route file per
 * topic would be thirty modules that each do the same three things. Every page is
 * still a real URL — `/docs/prosecute` can be linked, shared and opened cold, which
 * a single client-side switcher would have thrown away for nothing.
 *
 * `generateStaticParams` prerenders all of them at build time. Nothing here reads
 * the chain, so there is no reason for a documentation page to be dynamic.
 */

interface Props {
  params: Promise<{ slug?: string[] }>;
}

/**
 * The documentation's own share card, on paper where the marketing card is on ink,
 * so the two links are tellable apart at thumbnail size in the same timeline.
 */
const OG_IMAGE = {
  url: '/og/docs.png',
  width: 1200,
  height: 630,
  alt: 'Watchtower documentation. How Creditcoin proves a claim. The precompile, the proof, the payout, and every rule the system obeys.',
};

const slugOf = (segments?: string[]) => (segments ?? []).join('/');

export function generateStaticParams() {
  return allPages().map(({ page }) => ({
    slug: page.slug ? page.slug.split('/') : [],
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = findPage(slugOf((await params).slug));
  if (!found) return { title: 'Not found — Watchtower docs' };

  const title = `${found.page.title} — Watchtower docs`;

  /**
   * `openGraph` and `twitter` are replaced wholesale per segment rather than deep
   * merged, so the root's siteName, card type and image all have to be restated
   * here. Left off, every documentation page would either unfurl under the
   * marketing card's title or lose its image entirely.
   */
  return {
    title,
    description: found.page.lede,
    openGraph: {
      type: 'article',
      siteName: 'Watchtower',
      url: hrefOf(found.page),
      title,
      description: found.page.lede,
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: found.page.lede,
      images: [OG_IMAGE],
    },
  };
}

export default async function DocsPage({ params }: Props) {
  const found = findPage(slugOf((await params).slug));
  if (!found) notFound();

  const { page, section } = found;
  const toc = tocOf(page);
  const { prev, next } = neighbours(page.slug);

  return (
    <>
      <main className="min-w-0 pb-32 pt-10 lg:pt-14">
        {/* ------------------------------------------------------- title block */}
        <header className="border-b border-ink/12 pb-9">
          <p className="label mb-5 text-ink/45">{section.title}</p>
          <h1 className="display text-[clamp(2.25rem,5vw,3.5rem)]">{page.title}</h1>
          <p className="mt-6 max-w-[62ch] text-[17px] leading-relaxed text-ink/60">{page.lede}</p>
        </header>

        {/* -------------------------------------------------- contents, narrow */}
        {toc.length > 0 && (
          <details className="mt-8 rounded-lg border border-ink/12 bg-card px-5 py-4 xl:hidden">
            <summary className="label cursor-pointer list-none text-ink/50 [&::-webkit-details-marker]:hidden">
              On this page
            </summary>
            <ul className="mt-4 space-y-2 border-l border-ink/12 pl-4">
              {toc.map((entry) => (
                <li key={entry.id}>
                  <a
                    href={`#${entry.id}`}
                    className="block text-[13.5px] leading-snug text-ink/60 transition-colors hover:text-ink"
                  >
                    {entry.text}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="mt-12">
          <DocBody blocks={page.blocks} />
        </div>

        {/* ------------------------------------------------------ prev / next */}
        {(prev || next) && (
          <nav className="mt-24 grid gap-3 border-t border-ink/12 pt-8 sm:grid-cols-2">
            {prev ? <Neighbour direction="prev" href={hrefOf(prev.page)} title={prev.page.title} /> : <span />}
            {next && <Neighbour direction="next" href={hrefOf(next.page)} title={next.page.title} />}
          </nav>
        )}
      </main>

      {/* ------------------------------------------------ contents, wide screens */}
      <aside className="hidden xl:block xl:sticky xl:top-[6.5rem] xl:h-fit xl:pt-14">
        <DocsToc entries={toc} />
      </aside>
    </>
  );
}

/** One end of the reading order. The arrow leads on the way back and follows on the way on. */
function Neighbour({
  direction,
  href,
  title,
}: {
  direction: 'prev' | 'next';
  href: string;
  title: string;
}) {
  const isNext = direction === 'next';
  return (
    <Link
      href={href}
      className={`group rounded-lg border border-ink/12 bg-card px-6 py-5 transition-colors hover:border-accent ${
        isNext ? 'sm:text-right' : ''
      }`}
    >
      <span className="label block text-ink/45">{isNext ? 'Next' : 'Previous'}</span>
      <span className="mt-2 flex items-center gap-2 text-[15px] font-semibold text-ink sm:justify-start">
        {!isNext && (
          <span aria-hidden className="text-ink/40 transition-transform duration-200 group-hover:-translate-x-1">
            ←
          </span>
        )}
        <span className={isNext ? 'ml-auto' : ''}>{title}</span>
        {isNext && (
          <span aria-hidden className="text-ink/40 transition-transform duration-200 group-hover:translate-x-1">
            →
          </span>
        )}
      </span>
    </Link>
  );
}
