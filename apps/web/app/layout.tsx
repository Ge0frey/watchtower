import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AmbientHeader } from '@/components/AmbientHeader';
import { WorkerBanner } from '@/components/WorkerBanner';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Watchtower',
  description: 'Proof-native insurance for Ethereum, underwritten on Creditcoin.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AmbientHeader />
          <main className="shell">
            <WorkerBanner />
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
