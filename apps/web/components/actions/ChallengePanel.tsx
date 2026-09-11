'use client';

import { useEffect, useState } from 'react';
import { RULES, watchtowerCoreAbi, type Incident } from '@watchtower/shared';
import { CORE } from '@/hooks/useChainState';
import { useWatchtowerWrite } from '@/hooks/useWatchtowerWrite';
import { api } from '@/lib/api';
import { ActionShell, ConnectGate, TxState } from './TxButton';

/**
 * The honest half of the design, made usable.
 *
 * You cannot prove a negative on-chain, so a solvency claim is never self-evident: it depends on the
 * prosecutor having skipped nothing. Instead of pretending otherwise, the claim is bonded and left
 * open for a window. Show one transaction they passed over inside the range they claimed to cover,
 * and the accumulator rolls back to its snapshot while their bond becomes yours.
 *
 * The fraud proof is an ordinary verified window - the same `submitEvidence` machinery, a single
 * transaction wide. Watchtower's defence runs on Watchtower.
 */
export function ChallengePanel({ incident }: { incident: Incident }) {
  const [txHash, setTxHash] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const write = useWatchtowerWrite();
  const remaining = useCountdown(incident.challengeDeadline);

  const expired = remaining <= 0;
  const valid = /^0x[0-9a-fA-F]{64}$/.test(txHash.trim());

  async function challenge() {
    setPrepError(null);
    setPreparing(true);
    try {
      // The worker builds the proof; it cannot forge one, because the precompile re-verifies
      // everything inside the transaction your wallet signs.
      const prepared = await api.prosecute({
        txHashes: [txHash.trim()],
        subjectId: incident.subjectId,
        ruleId: RULES.reserveConservation.id,
        chainKey: 1,
        mode: 'self',
      });
      await write.send({
        address: CORE,
        abi: watchtowerCoreAbi,
        functionName: 'challengeGap',
        args: [incident.id, rehydrate(prepared.input)],
      });
    } catch (e) {
      setPrepError(e instanceof Error ? e.message : 'could not build the gap proof');
    } finally {
      setPreparing(false);
    }
  }

  if (incident.status !== 'open') return null;

  return (
    <ActionShell
      title={expired ? 'Challenge window closed' : 'Challenge this claim'}
      hint={expired ? 'ready to settle' : `${formatRemaining(remaining)} left`}
    >
      {expired ? (
        <>
          <p className="dim small">
            Nobody showed a skipped transaction inside the claimed range. The claim can now be paid.
          </p>
          <ConnectGate {...write} />
          <button
            className="btn"
            disabled={!write.canWrite || write.busy}
            onClick={() =>
              write.send({
                address: CORE,
                abi: watchtowerCoreAbi,
                functionName: 'settleBreach',
                args: [incident.id],
              })
            }
          >
            Settle breach
          </button>
        </>
      ) : (
        <>
          <p className="dim small">
            If this prosecutor skipped a transaction from this custodian between their starting cursor
            and the entry they filed, prove it. The accumulator rolls back and their bond is yours.
          </p>
          <div className="field-row">
            <label className="field-label" htmlFor={`gap-${incident.id}`}>skipped tx hash (Sepolia)</label>
            <input
              id={`gap-${incident.id}`}
              className="input mono"
              placeholder="0x…"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              spellCheck={false}
            />
          </div>
          <ConnectGate {...write} />
          <button className="btn btn-warn" disabled={!write.canWrite || write.busy || preparing || !valid} onClick={challenge}>
            {preparing ? 'building proof…' : 'Submit gap proof'}
          </button>
          {prepError && <div className="tx-state tx-error">{prepError}</div>}
        </>
      )}

      <TxState status={write.status} hash={write.hash} error={write.error} confirmedLabel="challenge upheld — bond slashed" />
    </ActionShell>
  );
}

/**
 * The worker serialises bigints to strings so the payload survives JSON. Turn them back before the
 * wallet sees them, or viem encodes a uint64 from a string and the call reverts.
 */
export function rehydrate(input: Record<string, unknown>) {
  return {
    ...input,
    chainKey: BigInt(input.chainKey as string),
    blockHeights: (input.blockHeights as string[]).map(BigInt),
  };
}

function useCountdown(deadlineSeconds: number) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  return deadlineSeconds - now;
}

function formatRemaining(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
