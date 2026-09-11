import type { Address, Hex } from 'viem';

export interface Deployment {
  subjectRegistry: Address;
  underwritingVault: Address;
  watchtowerCore: Address;
  rules: {
    intraBlockExtraction: Address;
    reserveConservation: Address;
    chainlinkFeed: Address;
    failedTx: Address;
  };
  subjects: {
    pool: Hex;
    bridge: Hex;
    feed: Hex;
    account: Hex;
  };
  sourceContracts: {
    /** Uniswap V2 pool on Ethereum Mainnet that the sandwich rule watches. */
    pool: Address;
    /** Chainlink ETH/USD AGGREGATOR (not the proxy - `AnswerUpdated` is emitted by the aggregator). */
    aggregator: Address;
    /** DemoBridge on Ethereum Sepolia. */
    bridge: Address;
    /** Address whose failed transactions are covered. */
    failedTxWatch: Address;
  };
}

const zeroAddress = '0x0000000000000000000000000000000000000000' as Address;
const zeroHash = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex;

/** Filled from the environment so the worker, the scripts and the UI always agree. */
export function deploymentFromEnv(env: Record<string, string | undefined>): Deployment {
  const addr = (key: string): Address => (env[key] ?? zeroAddress) as Address;
  const hash = (key: string): Hex => (env[key] ?? zeroHash) as Hex;

  return {
    subjectRegistry: addr('SUBJECT_REGISTRY'),
    underwritingVault: addr('UNDERWRITING_VAULT'),
    watchtowerCore: addr('WATCHTOWER_CORE'),
    rules: {
      intraBlockExtraction: addr('RULE_INTRABLOCK'),
      reserveConservation: addr('RULE_RESERVE'),
      chainlinkFeed: addr('RULE_FEED'),
      failedTx: addr('RULE_FAILEDTX'),
    },
    subjects: {
      pool: hash('SUBJECT_POOL'),
      bridge: hash('SUBJECT_BRIDGE'),
      feed: hash('SUBJECT_FEED'),
      account: hash('SUBJECT_ACCOUNT'),
    },
    sourceContracts: {
      pool: addr('DEMO_POOL_MAINNET'),
      aggregator: addr('DEMO_AGGREGATOR_MAINNET'),
      bridge: addr('DEMO_BRIDGE_SEPOLIA'),
      failedTxWatch: addr('DEMO_FAILED_TX_WATCH'),
    },
  };
}
