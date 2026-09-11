'use client';

import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatCtc, formatUsd, underwritingVaultAbi } from '@watchtower/shared';
import { VAULT, type ChainSubject } from '@/hooks/useChainState';
import { useWatchtowerWrite } from '@/hooks/useWatchtowerWrite';
import { ActionShell, ConnectGate, TxState } from './TxButton';

const THIRTY_DAYS = 30n * 24n * 60n * 60n;

/**
 * Buy cover on a subject.
 *
 * The premium is never computed in JavaScript. `usdToCtc` is read from the vault and the contract's
 * own formula applied to it - 1% of cover per 30 days - so the number quoted here is the number the
 * contract will demand. A UI that guesses this and rounds differently just produces `PremiumTooLow`.
 */
export function CoverDialog({ subject }: { subject: ChainSubject }) {
  const { address } = useAccount();
  const [dollars, setDollars] = useState('2');
  const write = useWatchtowerWrite();

  const coverUsd = BigInt(Math.max(0, Math.round(Number(dollars || '0') * 1e8)));

  const { data: coverCtc } = useReadContract({
    address: VAULT,
    abi: underwritingVaultAbi,
    functionName: 'usdToCtc',
    args: [coverUsd],
    query: { enabled: coverUsd > 0n },
  });

  const { data: held } = useReadContract({
    address: VAULT,
    abi: underwritingVaultAbi,
    functionName: 'coverOf',
    args: address ? [subject.id, address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const premium = coverCtc ? (coverCtc * THIRTY_DAYS) / (100n * THIRTY_DAYS) : 0n;

  async function buy() {
    await write.send({
      address: VAULT,
      abi: underwritingVaultAbi,
      functionName: 'buyCover',
      args: [subject.id, coverUsd, THIRTY_DAYS],
      value: premium,
    });
  }

  return (
    <ActionShell title="Buy cover" hint="1% of cover per 30 days">
      {held !== undefined && (held as bigint) > 0n && (
        <p className="dim small">You hold {formatUsd(held as bigint)} of cover on this subject.</p>
      )}

      <div className="field-row">
        <label className="field-label" htmlFor={`cover-${subject.id}`}>cover (USD)</label>
        <input
          id={`cover-${subject.id}`}
          className="input mono"
          value={dollars}
          onChange={(e) => setDollars(e.target.value.replace(/[^0-9.]/g, ''))}
          inputMode="decimal"
        />
      </div>

      <dl className="quote">
        <div><dt>cover</dt><dd>{formatUsd(coverUsd)}</dd></div>
        <div><dt>premium</dt><dd>{formatCtc(premium, 4)}</dd></div>
        <div><dt>term</dt><dd>30 days</dd></div>
      </dl>

      <ConnectGate {...write} />
      <button className="btn" disabled={!write.canWrite || write.busy || coverUsd === 0n} onClick={buy}>
        {write.busy ? 'working…' : 'Buy cover'}
      </button>
      <TxState status={write.status} hash={write.hash} error={write.error} confirmedLabel="cover active" />

      <p className="dim small">
        You never file a claim. If the rule below is ever proven against this subject, restitution is
        paid to your wallet automatically, capped by your cover.
      </p>
    </ActionShell>
  );
}
