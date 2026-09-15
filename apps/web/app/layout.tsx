import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Archivo, JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

/**
 * Two faces, one job each.
 *
 * Archivo is the whole voice of the interface — a neo-grotesque that holds at 900
 * across a headline eleven viewport-widths tall and still sets a 13px table label.
 * Using one family at every size is what lets the pages go quiet: the hierarchy is
 * carried by weight and scale, never by a second typeface competing for attention.
 *
 * JetBrains Mono carries every number this application asserts — coordinates,
 * hashes, amounts. Both are self-hosted through next/font, because a webfont that
 * fails to load would silently reflow the one thing that has to stay exact.
 */
const sans = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const TITLE = 'Watchtower — proof-native insurance for Ethereum';
const DESCRIPTION =
  'Ethereum cannot see the transactions beside it in its own block. Creditcoin can. Watchtower pays out on proof alone.';

/**
 * The share card. 1200x630, the summary_large_image bed X, LinkedIn, Slack and
 * Discord all crop to. `/docs` declares its own; everything else shares this one.
 *
 * It is a static asset referenced by hand rather than an `opengraph-image.png`
 * file convention, and that is deliberate. The documentation is one optional
 * catch-all route, so a convention file under it resolves to
 * `/docs/[[...slug]]/opengraph-image.png`, which builds clean and then throws
 * "Catch-all must be the last part of the URL" on every request. Hoisting the
 * file to the `docs` segment fixes the route and breaks the tag instead: a child
 * `generateMetadata` that sets `openGraph` replaces the parent's resolved object
 * wholesale, so the inherited image is dropped and the docs pages unfurl with no
 * card at all. Naming the image in both places is the only arrangement where the
 * per-page titles and the image both survive.
 */
const OG_IMAGE = {
  url: '/og/home.png',
  width: 1200,
  height: 630,
  alt: 'Watchtower. Insure against MEV and sandwich attacks. Every claim is a cryptographic proof, verified on Creditcoin and settled in a single block.',
};

/**
 * `metadataBase` is what turns those relative paths into the absolute URLs every
 * crawler requires. Without it Next emits a bare path and the card silently fails
 * to unfurl.
 */
export const metadata: Metadata = {
  metadataBase: new URL('https://watchtower-attestation.vercel.app'),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: 'Watchtower',
    url: '/',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="bg-paper text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
