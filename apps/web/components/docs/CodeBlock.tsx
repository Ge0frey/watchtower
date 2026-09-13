'use client';

import { useState } from 'react';

/**
 * A listing, on ink.
 *
 * The documentation is set on paper like the rest of the application, so a code
 * block is the one place a band of ink appears mid-page — which is exactly the
 * paper/ink alternation the landing page already uses, at paragraph scale. It also
 * does the useful thing of making a command look like something you run rather than
 * something you read.
 *
 * Copy reports itself in the button's own label for a moment and then stops. There
 * is no toast, because a toast for copying two words is a notification about
 * nothing.
 */
export function CodeBlock({ code, caption }: { code: string; caption?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* a browser that refuses the clipboard still shows the text — select it */
    }
  }

  return (
    <figure className="my-8 overflow-hidden rounded-lg border border-ink bg-ink">
      <figcaption className="flex items-center justify-between gap-4 border-b border-paper/12 px-5 py-2.5">
        <span className="label text-paper/45">{caption ?? 'Terminal'}</span>
        <button
          type="button"
          onClick={copy}
          className="label shrink-0 rounded-sm px-2 py-1 text-paper/45 transition-colors hover:bg-paper/10 hover:text-paper"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </figcaption>
      <pre className="overflow-x-auto px-5 py-4">
        <code className="block font-mono text-[12.5px] leading-[1.75] text-paper/85">{code}</code>
      </pre>
    </figure>
  );
}
