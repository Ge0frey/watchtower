import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '../../.env') });

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const env = {
  cc3Rpc: process.env.CC3_RPC ?? 'https://rpc.cc3-testnet.creditcoin.network',
  proofBuilderUrl: process.env.PROOF_BUILDER_URL ?? 'https://prover.cc3-testnet.creditcoin.network',
  mainnetRpc: () => required('MAINNET_RPC'),
  sepoliaRpc: () => required('SEPOLIA_RPC'),
  mainnetRpcFallback: process.env.MAINNET_RPC_FALLBACK,
  sepoliaRpcFallback: process.env.SEPOLIA_RPC_FALLBACK,
  prosecutorPk: () => required('PROSECUTOR_PK'),
  raw: process.env as Record<string, string | undefined>,
};
