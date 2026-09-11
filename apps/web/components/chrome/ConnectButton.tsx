'use client';

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
    return (
      <button
        className={`${base} border-ink/25 text-ink/75 hover:border-ink hover:text-ink`}
        onClick={() => disconnect()}
        title="disconnect"
      >
        {shortHash(address)}
      </button>
    );
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
