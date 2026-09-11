import type { ReactNode } from 'react';
import { AppHeader } from '@/components/chrome/AppHeader';
import { WorkerBanner } from '@/components/chrome/WorkerBanner';

/**
 * The application shell.
 *
 * One measure, one generous top margin, and nothing else. Every route lays itself
 * out inside `shell`, so the left edge of a heading never moves as you navigate —
 * which is most of what makes a multi-tool application feel like one document.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="shell pt-14 pb-32">
        <WorkerBanner />
        {children}
      </main>
    </div>
  );
}
