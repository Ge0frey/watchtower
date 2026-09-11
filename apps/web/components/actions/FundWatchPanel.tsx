'use client';

import { useState } from 'react';
import { parseEther } from 'viem';
import { formatCtc, underwritingVaultAbi } from '@watchtower/shared';
import { VAULT, type ChainSubject } from '@/hooks/useChainState';
import { useWatchtowerWrite } from '@/hooks/useWatchtowerWrite';
import { Button, Field, Input } from '@/components/ui';
import { ActionShell, ConnectGate, TxState } from './TxButton';

/**
 * Put a bounty on a subject.
 *
 * This is the part that makes "permissionless prosecutors" a market rather than a diagram: anyone
 * who wants a contract watched can pay for the watching, and any stranger can collect by proving
 * something about it.
 */
export function FundWatchPanel({ subject }: { subject: ChainSubject }) {
  const [amount, setAmount] = useState('0.1');
  const write = useWatchtowerWrite();

  const wei = (() => {
    try { return parseEther(amount || '0'); } catch { return 0n; }
  })();

  return (
    <ActionShell title="Fund a watch" hint="pays whoever proves something here">
      <p className="text-[13px] leading-relaxed text-ink/50">
        Bounty pool: <span className="font-mono text-ink">{formatCtc(subject.bountyPool, 3)}</span>.
        A prosecutor delivering fresh evidence takes the full bounty; evidence past the 24-hour
        checkpoint cliff earns 20% of it, because its continuity proof costs roughly ten times the
        gas.
      </p>

      <Field label="amount (CTC)">
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          inputMode="decimal"
        />
      </Field>

      <ConnectGate {...write} />
      <Button
        disabled={!write.canWrite || write.busy || wei === 0n}
        onClick={() =>
          write.send({
            address: VAULT,
            abi: underwritingVaultAbi,
            functionName: 'fundWatch',
            args: [subject.id],
            value: wei,
          })
        }
      >
        Fund watch
      </Button>
      <TxState status={write.status} hash={write.hash} error={write.error} confirmedLabel="bounty funded" />
    </ActionShell>
  );
}
