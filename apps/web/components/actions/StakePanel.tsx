'use client';

import { useState } from 'react';
import { parseEther } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { formatCtc, underwritingVaultAbi } from '@watchtower/shared';
import { VAULT, type ChainSubject } from '@/hooks/useChainState';
import { useWatchtowerWrite } from '@/hooks/useWatchtowerWrite';
import { Button, Field, Input, Notice, Row } from '@/components/ui';
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
      <div>
        <Row label="tranche" value={formatCtc(subject.staked, 2)} />
        <Row label="premiums earned" value={formatCtc(subject.premiums, 4)} />
        <Row label="paid out" value={formatCtc(subject.paidOut, 2)} />
        <Row label="your stake" value={formatCtc(staked, 4)} />
        <Row label="your premiums" value={formatCtc(claimable, 4)} tone={claimable > 0n ? 'settled' : 'neutral'} />
      </div>

      <Field label="amount (CTC)">
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          inputMode="decimal"
        />
      </Field>

      <ConnectGate {...write} />

      <div className="flex flex-wrap gap-2">
        <Button
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
        </Button>

        <Button
          variant="ghost"
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
        </Button>

        <Button
          variant="ghost"
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
        </Button>
      </div>

      <p className="text-[13px] leading-relaxed text-ink/50">
        Unstaking pays out any premiums owed in the same transaction &mdash; claiming separately is
        only for taking the income while leaving the capital at work.
      </p>

      {subject.frozen && (
        <Notice>
          Withdrawals are frozen: a breach has been proven against this subject and is awaiting
          settlement. Underwriters cannot exit between a proven violation and its payout.
        </Notice>
      )}

      <TxState status={write.status} hash={write.hash} error={write.error} confirmedLabel="position updated" />
    </ActionShell>
  );
}
