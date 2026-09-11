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

  const wrongNetwork = isConnected && chainId !== creditcoinTestnet.id;

  if (wrongNetwork) {
    return (
      <button className="btn btn-warn" disabled={switching} onClick={() => switchChain({ chainId: creditcoinTestnet.id })}>
        {switching ? 'switching…' : 'Switch to Creditcoin'}
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <button className="btn btn-ghost mono" onClick={() => disconnect()} title="disconnect">
        {shortHash(address)}
      </button>
    );
  }

  const injected = connectors[0];
  return (
    <button
      className="btn"
      disabled={!injected || isPending}
      onClick={() => injected && connect({ connector: injected })}
      title={injected ? 'connect an injected wallet' : 'no wallet detected in this browser'}
    >
      {isPending ? 'connecting…' : injected ? 'Connect' : 'No wallet'}
    </button>
  );
}
