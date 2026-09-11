import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/chrome/SiteFooter';
import { SiteHeader } from '@/components/chrome/SiteHeader';

/**
 * The marketing shell: a thin header, the page, a checkable footer.
 *
 * Deliberately separate from the application shell. Someone meeting Watchtower for
 * the first time should not be handed a navigation bar of five tools they have no
 * context for — they get the argument, and one door into the product.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="pt-[72px]">{children}</main>
      <SiteFooter />
    </div>
  );
}
