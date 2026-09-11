import { keccak256, toHex } from 'viem';

/** Evidence-window shapes, mirroring `WindowShape` in Types.sol. */
export enum WindowShape {
  SingleTx = 0,
  IntraBlockAdjacent = 1,
  SequentialStream = 2,
}

/** Settlement modes, mirroring `Settlement` in Types.sol. */
export enum Settlement {
  Instant = 0,
  Optimistic = 1,
}

export enum SubjectKind {
  Pool = 0,
  Custodian = 1,
  Feed = 2,
  Account = 3,
}

/** Rule ids are keccak of the literal, exactly as the Solidity constants compute them. */
export const ruleId = (literal: string) => keccak256(toHex(literal));

export const RULES = {
  intraBlockExtraction: {
    id: ruleId('watchtower.rule.intra-block-extraction.v1'),
    name: 'IntraBlockExtraction',
    shape: WindowShape.IntraBlockAdjacent,
    settlement: Settlement.Instant,
    windowSize: 3,
    headline: 'A searcher bracketed a victim swap inside one Ethereum block.',
  },
  reserveConservation: {
    id: ruleId('watchtower.rule.reserve-conservation.v1'),
    name: 'ReserveConservation',
    shape: WindowShape.SequentialStream,
    settlement: Settlement.Optimistic,
    windowSize: 10,
    headline: 'A custodian minted more than it locked.',
  },
  chainlinkFeed: {
    id: ruleId('watchtower.rule.chainlink-feed.v1'),
    name: 'ChainlinkFeed',
    shape: WindowShape.SequentialStream,
    settlement: Settlement.Optimistic,
    windowSize: 10,
    headline: 'The price Chainlink published, proven rather than reported.',
  },
  failedTx: {
    id: ruleId('watchtower.rule.failed-tx.v1'),
    name: 'FailedTx',
    shape: WindowShape.SingleTx,
    settlement: Settlement.Instant,
    windowSize: 1,
    headline: 'An Ethereum transaction reverted and burned gas for nothing.',
  },
  gapChallenge: {
    id: ruleId('watchtower.rule.gap-challenge.v1'),
    name: 'GapChallenge',
    shape: WindowShape.SingleTx,
    settlement: Settlement.Instant,
    windowSize: 1,
    headline: 'Proof that a stream skipped a relevant transaction.',
  },
} as const;

export type RuleKey = keyof typeof RULES;

export function ruleByIdOrNull(id: string) {
  const entry = Object.values(RULES).find((r) => r.id.toLowerCase() === id.toLowerCase());
  return entry ?? null;
}

/** Event signatures the rules and scanners agree on. */
export const TOPICS = {
  swapV2: 'Swap(address,uint256,uint256,uint256,uint256,address)',
  locked: 'Locked(address,uint256)',
  unlocked: 'Unlocked(address,uint256)',
  minted: 'Minted(address,uint256)',
  burned: 'Burned(address,uint256)',
  answerUpdated: 'AnswerUpdated(int256,uint256,uint256)',
} as const;

export const topicHash = (signature: string) => keccak256(toHex(signature));
