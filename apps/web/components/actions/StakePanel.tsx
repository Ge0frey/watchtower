'use client';

import { useState } from 'react';
import { parseEther } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { formatCtc, underwritingVaultAbi } from '@watchtower/shared';
import { VAULT, type ChainSubject } from '@/hooks/useChainState';
import { useWatchtowerWrite } from '@/hooks/useWatchtowerWrite';
import { ActionShell, ConnectGate, TxState } from './TxButton';

/**
 * Underwrite a subject, or withdraw.
 *
 * `unstake` reverts while the subject is frozen, which the core does the moment a breach is proven.
 * That is deliberate - underwriters cannot exit between a proven violation and its settlement - so
 * the UI explains the reason rather than presenting a dead button.
 */
export function StakePanel({ subject }: { subject: ChainSubject }) {
  const { address } = useAccount();
  const [amount, setAmount] = useState('0.1');
  const write = useWatchtowerWrite();

  const { data: myStake } = useReadContract({
    address: VAULT,
    abi: underwritingVaultAbi,
    functionName: 'stakeOf',
    args: address ? [subject.id, address] : undefined,
    query: { enabled: Boolean(address) },
  });

  // Premiums accrue per unit of stake the moment cover is bought. Showing the lifetime figure
  // without showing what is actually yours would be advertising income nobody can collect.
  const { data: myPremiums } = useReadContract({
    address: VAULT,
    abi: underwritingVaultAbi,
    functionName: 'claimablePremiums',
    args: address ? [subject.id, address] : undefined,
    query: { enabled: Boolean(address), refetchInterval: 5000 },
  });

  const wei = (() => {
    try { return parseEther(amount || '0'); } catch { return 0n; }
  })();

  const staked = (myStake as bigint | undefined) ?? 0n;
  const claimable = (myPremiums as bigint | undefined) ?? 0n;

  return (
    <ActionShell title="Underwrite" hint="earn premiums, bear payout risk">
      <dl className="quote">
        <div><dt>tranche</dt><dd>{formatCtc(subject.staked, 2)}</dd></div>
        <div><dt>premiums</dt><dd>{formatCtc(subject.premiums, 4)}</dd></div>
        <div><dt>paid out</dt><dd>{formatCtc(subject.paidOut, 2)}</dd></div>
        <div><dt>your stake</dt><dd>{formatCtc(staked, 4)}</dd></div>
        <div><dt>your premiums</dt><dd>{formatCtc(claimable, 4)}</dd></div>
      </dl>

      <div className="field-row">
        <label className="field-label" htmlFor={`stake-${subject.id}`}>amount (CTC)</label>
        <input
          id={`stake-${subject.id}`}
          className="input mono"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          inputMode="decimal"
        />
      </div>

      <ConnectGate {...write} />

      <div className="btn-row">
        <button
          className="btn"
          disabled={!write.canWrite || write.busy || wei === 0n}
          onClick={() =>
            write.send({
              address: VAULT,
              abi: underwritingVaultAbi,
              functionName: 'stake',
              args: [subject.id],
              value: wei,
            })
          }
        >
          Stake
        </button>

        <button
          className="btn btn-ghost"
          disabled={!write.canWrite || write.busy || wei === 0n || subject.frozen || staked < wei}
          title={subject.frozen ? 'frozen: this subject has an unresolved breach' : undefined}
          onClick={() =>
            write.send({
              address: VAULT,
              abi: underwritingVaultAbi,
              functionName: 'unstake',
              args: [subject.id, wei],
            })
          }
        >
          Unstake
        </button>

        <button
          className="btn btn-ghost"
          disabled={!write.canWrite || write.busy || claimable === 0n}
          title="premiums earned by your stake, without withdrawing the stake"
          onClick={() =>
            write.send({
              address: VAULT,
              abi: underwritingVaultAbi,
              functionName: 'claimPremiums',
              args: [subject.id],
            })
          }
        >
          Claim premiums
        </button>
      </div>

      <p className="dim small">
        Unstaking pays out any premiums owed in the same transaction &mdash; claiming separately is
        only for taking the income while leaving the capital at work.
      </p>

      {subject.frozen && (
        <p className="notice small">
          Withdrawals are frozen: a breach has been proven against this subject and is awaiting
          settlement. Underwriters cannot exit between a proven violation and its payout.
        </p>
      )}

      <TxState status={write.status} hash={write.hash} error={write.error} confirmedLabel="position updated" />
    </ActionShell>
  );
}
