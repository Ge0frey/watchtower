import { defineChain } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

/**
 * Creditcoin CC3 Testnet.
 *
 * The chain id was read from the live RPC (`eth_chainId` -> 0x18e8f), not copied from docs, and it
 * matches `NativeQueryVerifierLib.isCreditcoinChainId` in @gluwa/asc-contracts, which recognises
 * 102030 (mainnet), 102031 (testnet) and 102032 (devnet).
 */
export const creditcoinTestnet = defineChain({
  id: 102031,
  name: 'Creditcoin CC3 Testnet',
  nativeCurrency: { name: 'Creditcoin', symbol: 'CTC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.cc3-testnet.creditcoin.network'] } },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://creditcoin-testnet.blockscout.com' },
  },
  testnet: true,
});

/** Attestcoin Protocol addresses and services on CC3 Testnet. */
export const attestcoin = {
  /** Block Prover Precompile. Native runtime code - `extcodesize` is 0 and that is expected. */
  blockProver: '0x0000000000000000000000000000000000000FD2',
  /** ChainInfo Precompile: supported chains and the latest attested height per chain. */
  chainInfo: '0x0000000000000000000000000000000000000fd3',
  /** Proof Builder service. Reach it only through @gluwa/usc-sdk - its REST paths are not public. */
  proofBuilderUrl: 'https://prover.cc3-testnet.creditcoin.network',
  /** Batch ceiling documented by the protocol and enforced by WatchtowerCore. */
  maxBatchSize: 10,
  maxBatchRangeBlocks: 1000,
} as const;

/**
 * Source chains, keyed by the protocol's `chainKey` - which is a Creditcoin-internal identifier and
 * deliberately NOT the EVM chain id.
 */
export const sourceChains = {
  1: { chainKey: 1, chain: sepolia, label: 'Ethereum Sepolia', explorer: 'https://sepolia.etherscan.io' },
  3: { chainKey: 3, chain: mainnet, label: 'Ethereum Mainnet', explorer: 'https://etherscan.io' },
} as const;

export type ChainKey = keyof typeof sourceChains;

export function explorerTxUrl(chainKey: ChainKey, txHash: string): string {
  return `${sourceChains[chainKey].explorer}/tx/${txHash}`;
}

export function creditcoinTxUrl(txHash: string): string {
  return `${creditcoinTestnet.blockExplorers.default.url}/tx/${txHash}`;
}

export function creditcoinAddressUrl(address: string): string {
  return `${creditcoinTestnet.blockExplorers.default.url}/address/${address}`;
}
