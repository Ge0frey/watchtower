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

export const metadata: Metadata = {
  title: 'Watchtower — proof-native insurance for Ethereum',
  description:
    'Ethereum cannot see the transactions beside it in its own block. Creditcoin can. Watchtower pays out on proof alone.',
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
