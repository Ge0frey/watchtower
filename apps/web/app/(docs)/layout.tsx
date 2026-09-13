import type { ReactNode } from 'react';
import { AppHeader } from '@/components/chrome/AppHeader';
import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { navTree } from '@/content/docs';

/**
 * The documentation shell.
 *
 * It keeps `AppHeader` — the same navigation, the same ink rail with the proven
 * head and the proven price still ticking — because the documentation is part of
 * the application and not a satellite site. A reader who opens the docs should not
 * feel they have left.
 *
 * What it does not keep is the `shell` measure. Every other route is one column of
 * prose or panels inside 1280px; a three-column documentation layout inside that
 * leaves the body at about 40 characters. So this layout sets its own wider bed —
 * a 17rem rail, the page, and a 14rem contents column — and drops both rails on
 * narrow screens, where the sidebar becomes a disclosure above the page.
 */
export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppHeader />

      <div className="mx-auto w-full max-w-[92rem] px-5 md:px-10">
        <div className="grid gap-10 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-14 xl:grid-cols-[17rem_minmax(0,1fr)_14rem]">
          {/* --------------------------------------------------------- contents */}
          <aside className="pt-8 lg:sticky lg:top-[6.5rem] lg:h-fit lg:pt-14">
            <DocsSidebar sections={navTree()} />
          </aside>

          {children}
        </div>
      </div>
    </div>
  );
}
