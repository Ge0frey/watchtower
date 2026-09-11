'use client';

import type { ReactNode } from 'react';
import { creditcoinTxUrl } from '@watchtower/shared';
import type { WriteStatus } from '@/hooks/useWatchtowerWrite';

/**
 * The shared tail of every write: what the transaction is doing right now, and a link once it lands.
 * Keeping it in one place is what stops each action inventing its own idea of "pending".
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

  return (
    <div className={`tx-state tx-${status}`}>
      {status === 'signing' && 'waiting for your wallet…'}
      {status === 'pending' && 'submitted — waiting for a Creditcoin block…'}
      {status === 'confirmed' && (
        <>
          {confirmedLabel}
          {hash && (
            <a className="tx-link" href={creditcoinTxUrl(hash)} target="_blank" rel="noreferrer">
              view ↗
            </a>
          )}
        </>
      )}
      {status === 'error' && (error ?? 'failed')}
    </div>
  );
}

export function ActionShell({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="action">
      <header className="action-head">
        <span className="action-title">{title}</span>
        {hint && <span className="dim small">{hint}</span>}
      </header>
      {children}
    </section>
  );
}

/** Every write path needs the same two gates before it can offer a button. */
export function ConnectGate({ canWrite, wrongNetwork, isConnected }: { canWrite: boolean; wrongNetwork: boolean; isConnected: boolean }) {
  if (canWrite) return null;
  return (
    <div className="notice small">
      {!isConnected
        ? 'Connect a wallet to act on this. Everything above reads without one.'
        : wrongNetwork
          ? 'Wrong network — switch to Creditcoin Testnet using the button in the header.'
          : null}
    </div>
  );
}
