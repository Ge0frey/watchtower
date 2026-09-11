'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import type { Abi } from 'viem';
import { creditcoinTestnet } from '@watchtower/shared';

/**
 * A contract write, described structurally.
 *
 * wagmi's own parameter type is a union across every function in every ABI, and narrowing it through
 * a wrapper makes TypeScript pick one arbitrary branch - which then rejects `value` on functions
 * that are plainly payable. Call sites keep their literal ABIs, so the real checking still happens
 * where the request is built.
 */
export interface WriteRequest {
  address: `0x${string}`;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

export type WriteStatus = 'idle' | 'signing' | 'pending' | 'confirmed' | 'error';

/**
 * One lifecycle for every on-chain action, so every button in the app behaves identically:
 * idle -> signing (wallet open) -> pending (in a block) -> confirmed, or error with a readable cause.
 *
 * On confirmation it invalidates the shared chain-state query, so the number a user just changed
 * updates from the chain rather than from an optimistic guess. Watchtower's rule is that anything
 * deciding money is read back from Creditcoin - that applies to our own writes too.
 */
export function useWatchtowerWrite() {
  const { isConnected, chainId } = useAccount();
  const queryClient = useQueryClient();
  const { writeContractAsync, reset } = useWriteContract();
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const [status, setStatus] = useState<WriteStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const receipt = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (!hash) return;
    if (receipt.isSuccess) {
      setStatus('confirmed');
      void queryClient.invalidateQueries({ queryKey: ['chain-state'] });
    } else if (receipt.isError) {
      setStatus('error');
      setError('transaction reverted on Creditcoin');
    }
  }, [hash, receipt.isSuccess, receipt.isError, queryClient]);

  const wrongNetwork = isConnected && chainId !== creditcoinTestnet.id;

  async function send(request: WriteRequest) {
    setError(null);
    setStatus('signing');
    try {
      const txHash = await writeContractAsync(request as Parameters<typeof writeContractAsync>[0]);
      setHash(txHash);
      setStatus('pending');
      return txHash;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // Wallet rejections are a choice, not a failure - say so plainly.
      setError(/user rejected|denied/i.test(message) ? 'cancelled in wallet' : firstLine(message));
      setStatus('error');
      return undefined;
    }
  }

  function clear() {
    setHash(undefined);
    setStatus('idle');
    setError(null);
    reset();
  }

  return {
    send,
    clear,
    hash,
    status,
    error,
    busy: status === 'signing' || status === 'pending',
    canWrite: isConnected && !wrongNetwork,
    wrongNetwork,
    isConnected,
  };
}

/** Contract revert strings arrive wrapped in paragraphs of RPC noise. */
function firstLine(message: string): string {
  const reason = message.match(/reverted with (?:the following reason|custom error)[:\s]+(.+)/i);
  if (reason?.[1]) return reason[1].split('\n')[0]!.trim();
  return message.split('\n')[0]!.slice(0, 120);
}
