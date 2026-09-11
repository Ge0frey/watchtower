'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAccount, useReadContracts } from 'wagmi';
import { formatCtc, formatUsd, shortHash, underwritingVaultAbi } from '@watchtower/shared';
import { api } from '@/lib/api';
import { VAULT, useChainState } from '@/hooks/useChainState';

/**
 * The capital side: who is backing what, what they have earned, and what has been paid out.
 * Plus your own positions, read from the chain rather than from any account we keep.
 */
export default function VaultPage() {
  const { data: subjects = [] } = useChainState();
  const { address, isConnected } = useAccount();
  const leaderboard = useQuery({ queryKey: ['leaderboard'], queryFn: api.leaderboard, refetchInterval: 10_000 });

  const positions = useReadContracts({
    allowFailure: false,
    contracts: address
      ? subjects.flatMap((s) => [
          { address: VAULT, abi: underwritingVaultAbi, functionName: 'stakeOf', args: [s.id, address] } as const,
          { address: VAULT, abi: underwritingVaultAbi, functionName: 'coverOf', args: [s.id, address] } as const,
        ])
      : [],
    query: { enabled: Boolean(address) && subjects.length > 0, refetchInterval: 5000 },
  });

  const staked = subjects.reduce((sum, s) => sum + s.staked, 0n);
  const premiums = subjects.reduce((sum, s) => sum + s.premiums, 0n);
  const paidOut = subjects.reduce((sum, s) => sum + s.paidOut, 0n);
  const bounties = subjects.reduce((sum, s) => sum + s.bountyPool, 0n);

  return (
    <>
      <div className="page-head">
        <h2>Vault</h2>
        <p className="dim">
          One vault underwrites every rule. Payouts are bounded three ways at once: by the holder&rsquo;s
          cover, by the subject&rsquo;s staked tranche, and by a per-block cap.
        </p>
      </div>

      <section className="stat-row">
        <Stat label="staked" value={formatCtc(staked, 2)} />
        <Stat label="premiums earned" value={formatCtc(premiums, 4)} />
        <Stat label="paid out" value={formatCtc(paidOut, 2)} />
        <Stat label="bounty pools" value={formatCtc(bounties, 2)} />
      </section>

      <section>
        <span className="section-label">tranches</span>
        <table className="table">
          <thead>
            <tr>
              <th>subject</th><th>staked</th><th>premiums</th><th>paid out</th><th>cap / block</th><th></th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.id}>
                <td>{s.label}{s.frozen && <span className="badge badge-warn">frozen</span>}</td>
                <td className="mono">{formatCtc(s.staked, 2)}</td>
                <td className="mono">{formatCtc(s.premiums, 4)}</td>
                <td className="mono">{formatCtc(s.paidOut, 2)}</td>
                <td className="mono">{formatCtc(s.payoutCapPerBlock, 0)}</td>
                <td><Link className="dim small" href={`/subjects/${s.id}`}>manage →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="detail-grid">
        <div className="panel">
          <span className="section-label">your positions</span>
          {!isConnected && <p className="dim small">Connect a wallet to see what you hold.</p>}
          {isConnected && (
            <table className="table">
              <thead><tr><th>subject</th><th>your stake</th><th>your cover</th></tr></thead>
              <tbody>
                {subjects.map((s, i) => {
                  const stake = (positions.data?.[i * 2] as bigint | undefined) ?? 0n;
                  const cover = (positions.data?.[i * 2 + 1] as bigint | undefined) ?? 0n;
                  if (stake === 0n && cover === 0n) return null;
                  return (
                    <tr key={s.id}>
                      <td>{s.label}</td>
                      <td className="mono">{formatCtc(stake, 4)}</td>
                      <td className="mono">{formatUsd(cover)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {isConnected && positions.data?.every((v) => v === 0n) && (
            <p className="dim small">Nothing yet. Open a subject to buy cover or stake.</p>
          )}
        </div>

        <div className="panel">
          <span className="section-label">prosecutors</span>
          <p className="dim small">
            Bounties earned for delivering proofs. The worker is open source &mdash; anyone can run one.
          </p>
          {(leaderboard.data ?? []).map((row) => (
            <div key={row.address} className="leader-row">
              <span className="mono">{shortHash(row.address)}</span>
              <span className="dim">{row.submissions} submitted</span>
              <span>{formatCtc(BigInt(row.bountiesWei), 4)}</span>
            </div>
          ))}
          {(leaderboard.data ?? []).length === 0 && <p className="dim small">No bounties claimed yet.</p>}
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
