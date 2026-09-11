'use client';

import { useQuery } from '@tanstack/react-query';
import { createPublicClient, http, type Address, type Hex } from 'viem';
import {
  creditcoinTestnet,
  subjectRegistryAbi,
  underwritingVaultAbi,
  watchtowerCoreAbi,
} from '@watchtower/shared';

/**
 * JSON-RPC batching, not Multicall3.
 *
 * CC3 Testnet has no Multicall3 deployed - `0xcA11bde0…` holds no code - so viem's `multicall` action
 * throws rather than degrading, and a dashboard built on it renders nothing at all. The node does
 * accept JSON-RPC batch arrays, which buys the property that actually matters here: every read for a
 * whole dashboard snapshot leaves in one HTTP request. Calls issued in the same tick are grouped.
 */
export const client = createPublicClient({
  chain: creditcoinTestnet,
  transport: http(undefined, { batch: { wait: 16 } }),
});

export const CORE = (process.env.NEXT_PUBLIC_WATCHTOWER_CORE ?? '0x') as Address;
export const REGISTRY = (process.env.NEXT_PUBLIC_SUBJECT_REGISTRY ?? '0x') as Address;
export const VAULT = (process.env.NEXT_PUBLIC_UNDERWRITING_VAULT ?? '0x') as Address;

export const deployed = CORE !== '0x' && REGISTRY !== '0x' && VAULT !== '0x';

export interface ChainSubject {
  id: Hex;
  label: string;
  kind: number;
  chainKey: number;
  sourceContract: Address;
  boundRule: Hex;
  priceSubject: Hex;
  payoutCapPerBlock: bigint;
  anchorHeight: bigint;
  active: boolean;
  locked: bigint;
  minted: bigint;
  price: bigint;
  cursorHeight: bigint;
  cursorIndex: number;
  staked: bigint;
  premiums: bigint;
  paidOut: bigint;
  bountyPool: bigint;
  frozen: boolean;
}

/**
 * The authoritative view. Read directly from Creditcoin, never from our own backend.
 *
 * Two round trips for every route: `allSubjects` returns the catalogue, then every per-subject read -
 * accumulator, tranche, bounty pool, frozen flag - is issued in the same tick and batched into one
 * HTTP request. Shared through TanStack Query's cache, so navigating between pages reuses one poll
 * rather than starting another.
 */
export function useChainState() {
  return useQuery({
    queryKey: ['chain-state'],
    refetchInterval: 3000,
    queryFn: async (): Promise<ChainSubject[]> => {
      if (!deployed) return [];

      const [ids, subjects] = await client.readContract({
        address: REGISTRY,
        abi: subjectRegistryAbi,
        functionName: 'allSubjects',
      });

      const reads = await Promise.all(
        ids.flatMap((id) => [
          client.readContract({ address: CORE, abi: watchtowerCoreAbi, functionName: 'stateOf', args: [id] }),
          client.readContract({ address: VAULT, abi: underwritingVaultAbi, functionName: 'trancheOf', args: [id] }),
          client.readContract({ address: VAULT, abi: underwritingVaultAbi, functionName: 'bountyPool', args: [id] }),
          client.readContract({ address: VAULT, abi: underwritingVaultAbi, functionName: 'frozen', args: [id] }),
        ]),
      );

      return ids.map((id, i) => {
        const s = subjects[i]!;
        const state = reads[i * 4] as { locked: bigint; minted: bigint; price: bigint; cursorHeight: bigint; cursorIndex: number };
        const tranche = reads[i * 4 + 1] as { staked: bigint; premiums: bigint; paidOut: bigint };

        return {
          id,
          label: s.label,
          kind: s.kind,
          chainKey: Number(s.chainKey),
          sourceContract: s.sourceContract,
          boundRule: s.boundRule,
          priceSubject: s.priceSubject,
          payoutCapPerBlock: s.payoutCapPerBlock,
          anchorHeight: s.anchorHeight,
          active: s.active,
          locked: state.locked,
          minted: state.minted,
          price: state.price,
          cursorHeight: state.cursorHeight,
          cursorIndex: state.cursorIndex,
          staked: tranche.staked,
          premiums: tranche.premiums,
          paidOut: tranche.paidOut,
          bountyPool: reads[i * 4 + 2] as bigint,
          frozen: reads[i * 4 + 3] as boolean,
        };
      });
    },
  });
}

export function useSubject(id?: string) {
  const query = useChainState();
  return {
    ...query,
    subject: query.data?.find((s) => s.id.toLowerCase() === (id ?? '').toLowerCase()),
  };
}

/** Reserve ratio for a custodial subject; `null` when nothing has been proven yet. */
export function reserveRatio(subject: ChainSubject): number | null {
  if (subject.minted === 0n) return subject.locked > 0n ? 1 : null;
  return Number((subject.locked * 10_000n) / subject.minted) / 10_000;
}

/** The dollar price a subject's damages are denominated in - its own, or its linked feed's. */
export function priceFor(subject: ChainSubject, all: ChainSubject[]): bigint {
  if (subject.price > 0n) return subject.price;
  const feed = all.find((s) => s.id.toLowerCase() === subject.priceSubject.toLowerCase());
  return feed?.price ?? 0n;
}
