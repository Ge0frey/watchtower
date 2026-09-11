'use client';

import { createConfig, http } from 'wagmi';
import { creditcoinTestnet } from '@watchtower/shared';

/**
 * Creditcoin CC3 Testnet only.
 *
 * Chain id 102031 was verified against the live RPC rather than copied from documentation, and it is
 * the value `NativeQueryVerifierLib.isCreditcoinChainId` recognises on-chain.
 *
 * No connector is imported on purpose. wagmi discovers injected wallets over EIP-6963 by default, and
 * pulling in `wagmi/connectors` drags the Base account SDK - and its broken `@x402/evm` dependency -
 * into the bundle. The dashboard is read-first anyway: everything renders with no wallet connected,
 * and only buying cover, staking and funding a watch need one.
 */
export const wagmiConfig = createConfig({
  chains: [creditcoinTestnet],
  multiInjectedProviderDiscovery: true,
  transports: {
    [creditcoinTestnet.id]: http(),
  },
  ssr: true,
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
