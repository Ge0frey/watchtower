import { FallbackProvider, JsonRpcProvider, Network } from 'ethers';
import { blockProver, chainInfo, proofProvider } from '@gluwa/usc-sdk';
import type { ChainKey } from '@watchtower/shared';
import { env } from './env.js';

/**
 * Every conversation with the Attestcoin Protocol goes through here.
 *
 * Two deliberate constraints:
 *  - `ethers` v6, not viem. It is the SDK's peer dependency, and the SDK is the only supported way
 *    to reach the Proof Builder: its REST paths are not publicly documented and every guessed path
 *    returns 404. Hand-rolling HTTP against it is not an option.
 *  - Providers are created once and shared, because `waitUntilHeightAttested` polls and the worker
 *    runs several scanners at the same time.
 */
export interface AttestcoinClient {
  creditcoin: JsonRpcProvider;
  source: (chainKey: ChainKey) => JsonRpcProvider | FallbackProvider;
  chainInfoProvider: chainInfo.PrecompileChainInfoProvider;
  prover: blockProver.PrecompileBlockProver;
  proofBuilder: (chainKey: ChainKey) => proofProvider.service.ProofBuilder;
}

let cached: AttestcoinClient | null = null;

/**
 * Build a provider that survives one endpoint going down.
 *
 * Source-chain reads are the part of the pipeline most exposed to someone else's uptime, and a
 * scanner that stalls silently is worse than one that errors. With a fallback configured, ethers
 * races both endpoints and accepts the first good answer (`quorum: 1`); with only one URL it is a
 * plain provider and nothing changes.
 */
function providerFor(primary: string, fallback: string | undefined, chainId: number): JsonRpcProvider | FallbackProvider {
  const network = Network.from(chainId);
  const main = new JsonRpcProvider(primary, network, { staticNetwork: network });
  if (!fallback) return main;

  return new FallbackProvider(
    [
      { provider: main, priority: 1, weight: 1, stallTimeout: 4_000 },
      {
        provider: new JsonRpcProvider(fallback, network, { staticNetwork: network }),
        priority: 2,
        weight: 1,
        stallTimeout: 4_000,
      },
    ],
    network,
    { quorum: 1 },
  );
}

export function createClient(): AttestcoinClient {
  if (cached) return cached;

  const creditcoin = new JsonRpcProvider(env.cc3Rpc);
  const sources: Partial<Record<ChainKey, JsonRpcProvider | FallbackProvider>> = {};
  const builders: Partial<Record<ChainKey, proofProvider.service.ProofBuilder>> = {};

  cached = {
    creditcoin,
    source(chainKey) {
      if (!sources[chainKey]) {
        sources[chainKey] =
          chainKey === 3
            ? providerFor(env.mainnetRpc(), env.mainnetRpcFallback, 1)
            : providerFor(env.sepoliaRpc(), env.sepoliaRpcFallback, 11155111);
      }
      return sources[chainKey]!;
    },
    chainInfoProvider: new chainInfo.PrecompileChainInfoProvider(creditcoin),
    prover: new blockProver.PrecompileBlockProver(creditcoin),
    proofBuilder(chainKey) {
      if (!builders[chainKey]) {
        builders[chainKey] = new proofProvider.service.ProofBuilder(
          chainKey,
          env.proofBuilderUrl,
          15_000,
        );
      }
      return builders[chainKey]!;
    },
  };

  return cached;
}

/**
 * Fail fast at boot, and produce a log line worth showing during the demo.
 *
 * `chainKey` is a Creditcoin-internal identifier, NOT an EVM chain id, so the mapping has to be
 * asserted rather than assumed: on CC3 Testnet, key 1 is Sepolia (11155111) and key 3 is Ethereum
 * Mainnet (1) - which is what lets Watchtower prosecute real, historical mainnet sandwiches from a
 * testnet deployment.
 */
export async function assertSupportedChains(client: AttestcoinClient): Promise<void> {
  const supported = await client.chainInfoProvider.getSupportedChains();
  const byKey = new Map(supported.map((c) => [Number(c.chainKey), c]));

  for (const [chainKey, expectedChainId] of [
    [1, 11155111],
    [3, 1],
  ] as const) {
    const entry = byKey.get(chainKey);
    if (!entry) throw new Error(`Attestcoin does not support chainKey ${chainKey} on this network`);
    if (Number(entry.chainId) !== expectedChainId) {
      throw new Error(
        `chainKey ${chainKey} maps to chainId ${entry.chainId}, expected ${expectedChainId}`,
      );
    }
  }
}

/** Latest source-chain height the attestor network has committed on Creditcoin. */
export async function attestedHead(client: AttestcoinClient, chainKey: ChainKey): Promise<number> {
  const head = await client.chainInfoProvider.getLatestAttestedHeightAndHash(chainKey);
  return Number(head.height);
}
