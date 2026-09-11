'use client';

import type { ReactNode } from 'react';
import { creditcoinTxUrl } from '@watchtower/shared';
import { Label, Notice, type Tone } from '@/components/ui';
import type { WriteStatus } from '@/hooks/useWatchtowerWrite';

const STATE: Record<Exclude<WriteStatus, 'idle'>, { tone: Tone; text: string }> = {
  signing: { tone: 'pending', text: 'waiting for your wallet…' },
  pending: { tone: 'pending', text: 'submitted — waiting for a Creditcoin block…' },
  confirmed: { tone: 'settled', text: 'confirmed' },
  error: { tone: 'breach', text: 'failed' },
};

/**
 * The shared tail of every write: what the transaction is doing right now, and a link
 * once it lands. Keeping it in one place is what stops each action inventing its own
 * idea of "pending".
 */
export function TxState({
  status,
  hash,
  error,
  confirmedLabel = 'confirmed',
}: {
  status: WriteStatus;
  hash?: `0x${string}`;
  error?: string | null;
  confirmedLabel?: string;
}) {
  if (status === 'idle') return null;
  const state = STATE[status];

  return (
    <Notice tone={state.tone}>
      <span className="font-mono text-[12px]">
        {status === 'confirmed' ? confirmedLabel : status === 'error' ? (error ?? state.text) : state.text}
      </span>
      {status === 'confirmed' && hash && (
        <a
          className="ml-3 font-mono text-[11px] underline underline-offset-4 hover:no-underline"
          href={creditcoinTxUrl(hash)}
          target="_blank"
          rel="noreferrer"
        >
          view ↗
        </a>
      )}
    </Notice>
  );
}

/**
 * The frame every wallet action sits in, so they all read as the same object.
 *
 * The generous body spacing is the point: these are the only places in the product
 * where somebody spends money, and a form that feels crowded feels risky.
 */
export function ActionShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-ink/12 bg-card">
      <header className="flex items-center justify-between gap-4 border-b border-ink/10 px-6 py-4">
        <Label>{title}</Label>
        {hint && <span className="font-mono text-[10px] text-ink/35">{hint}</span>}
      </header>
      <div className="space-y-6 p-6">{children}</div>
    </section>
  );
}

/**
 * Every write path needs the same two gates before it can offer a button.
 *
 * Set as a hint rather than a notice on purpose: a subject page carries three of
 * these at once, and three amber boxes saying the same sentence is how a calm page
 * turns into a page that looks like it is failing. The wrong-network case is a real
 * mistake and keeps the louder treatment.
 */
export function ConnectGate({
  canWrite,
  wrongNetwork,
  isConnected,
}: {
  canWrite: boolean;
  wrongNetwork: boolean;
  isConnected: boolean;
}) {
  if (canWrite) return null;

  if (wrongNetwork) {
    return <Notice tone="breach">Wrong network &mdash; switch to Creditcoin Testnet in the header.</Notice>;
  }

  if (!isConnected) {
    return (
      <p className="border-t border-ink/10 pt-4 font-mono text-[11px] text-ink/45">
        Connect a wallet to act on this
      </p>
    );
  }

  return null;
}
