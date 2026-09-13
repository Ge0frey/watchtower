'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { creditcoinTestnet, shortHash } from '@watchtower/shared';

/**
 * Connect, and make the network mistake impossible to miss.
 *
 * No connector package is imported on purpose. wagmi discovers injected wallets over EIP-6963, and
 * pulling in `wagmi/connectors` drags the Base account SDK - and its unpublished `@x402/evm`
 * dependency - into the bundle, which breaks the Next build outright.
 *
 * Nothing on any page is gated behind this. The whole application reads without a wallet; only
 * spending needs one.
 */
export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  const base =
    'inline-flex shrink-0 items-center gap-2 rounded-md border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors disabled:pointer-events-none disabled:border-ink/10 disabled:bg-paper-dim disabled:text-ink/35';

  const wrongNetwork = isConnected && chainId !== creditcoinTestnet.id;

  if (wrongNetwork) {
    return (
      <button
        className={`${base} border-breach bg-breach text-paper hover:bg-transparent hover:text-breach`}
        disabled={switching}
        onClick={() => switchChain({ chainId: creditcoinTestnet.id })}
      >
        {switching ? 'switching…' : 'Wrong network'}
      </button>
    );
  }

  if (isConnected && address) {
    return <AccountMenu address={address} buttonClassName={base} onDisconnect={() => disconnect()} />;
  }

  const injected = connectors[0];
  return (
    <button
      className={`${base} border-accent bg-accent text-ink hover:border-accent-deep hover:bg-accent-deep hover:text-paper`}
      disabled={!injected || isPending}
      onClick={() => injected && connect({ connector: injected })}
      title={injected ? 'connect an injected wallet' : 'no wallet detected in this browser'}
    >
      {isPending ? 'connecting…' : injected ? 'Connect' : 'No wallet'}
    </button>
  );
}

/**
 * The connected address, and what you can do with it.
 *
 * Disconnecting used to be the button's only behaviour, which made the most destructive thing in the
 * header the easiest thing to hit by accident - a misclick dropped the session and the next action
 * had to re-authorise the wallet. A menu costs one extra click and makes the choice deliberate, and
 * it gives the address somewhere to be read in full and copied, which the truncated label cannot do.
 */
function AccountMenu({
  address,
  buttonClassName,
  onDisconnect,
}: {
  address: `0x${string}`;
  buttonClassName: string;
  onDisconnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const container = useRef<HTMLDivElement>(null);

  // A menu that survives a click elsewhere is a menu you have to dismiss twice.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // The confirmation is the label itself, and it goes back to saying what it does.
  useEffect(() => {
    if (copied === 'idle') return;
    const timer = setTimeout(() => setCopied('idle'), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      // `navigator.clipboard` is undefined outside a secure context and can reject when the
      // document is not focused, so the failure is reported rather than swallowed.
      await navigator.clipboard.writeText(address);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
  }

  const item =
    'block w-full px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.14em] text-ink/75 transition-colors hover:bg-paper-dim hover:text-ink';

  return (
    <div className="relative shrink-0" ref={container}>
      <button
        className={`${buttonClassName} border-ink/25 text-ink/75 hover:border-ink hover:text-ink ${
          open ? 'border-ink text-ink' : ''
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        title="account"
      >
        {shortHash(address)}
        <svg
          viewBox="0 0 10 6"
          aria-hidden="true"
          className={`h-[5px] w-[9px] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-60 overflow-hidden rounded-md border border-ink/15 bg-card"
        >
          {/* The full value, because a copy you cannot check is a copy you have to paste to trust. */}
          <p className="border-b border-ink/10 px-4 py-3 font-mono text-[10.5px] leading-relaxed break-all text-ink/45">
            {address}
          </p>
          <button role="menuitem" className={item} onClick={copy}>
            {copied === 'done' ? 'Copied' : copied === 'failed' ? 'Copy failed' : 'Copy address'}
          </button>
          <button
            role="menuitem"
            className={`${item} border-t border-ink/10`}
            onClick={() => {
              setOpen(false);
              onDisconnect();
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
