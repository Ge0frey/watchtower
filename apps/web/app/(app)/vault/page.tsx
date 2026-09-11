'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAccount, useReadContracts } from 'wagmi';
import { formatCtc, formatUsd, shortHash, underwritingVaultAbi } from '@watchtower/shared';
import { api } from '@/lib/api';
import { ArrowLink, Badge, Empty, PageHead, Section, Stat } from '@/components/ui';
import { VAULT, useChainState } from '@/hooks/useChainState';
import { useWorkerStatus } from '@/hooks/useWorkerStatus';

/**
 * The capital side: who is backing what, what they have earned, and what has been
 * paid out. Plus your own positions, read from the chain rather than from any account
 * we keep.
 */
export default function VaultPage() {
  const { data: subjects = [] } = useChainState();
  const { address, isConnected } = useAccount();
  const leaderboard = useQuery({
    queryKey: ['leaderboard'],
    queryFn: api.leaderboard,
    refetchInterval: 10_000,
    retry: false,
  });
  const { offline } = useWorkerStatus();

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

  const held = subjects
    .map((s, i) => ({
      subject: s,
      stake: (positions.data?.[i * 2] as bigint | undefined) ?? 0n,
      cover: (positions.data?.[i * 2 + 1] as bigint | undefined) ?? 0n,
    }))
    .filter((p) => p.stake > 0n || p.cover > 0n);

  return (
    <>
      <PageHead
        eyebrow="The balance sheet"
        title="Vault"
        lede="One vault underwrites every rule. Payouts are bounded three ways at once: by the holder's cover, by the subject's staked tranche, and by a per-block cap."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Capital staked" value={formatCtc(staked, 2)} size="lg" />
        <Stat
          label="Premiums earned"
          value={formatCtc(premiums, 4)}
          tone={premiums > 0n ? 'settled' : 'neutral'}
          size="lg"
        />
        <Stat label="Restitution paid" value={formatCtc(paidOut, 2)} size="lg" />
        <Stat label="Bounty pools" value={formatCtc(bounties, 2)} size="lg" />
      </div>

      <div className="mt-16 space-y-12">
        <Section title="Tranches" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-ink/10">
                  {['subject', 'staked', 'premiums', 'paid out', 'cap / block', ''].map((h) => (
                    <th key={h} className="label px-7 py-4 text-left font-normal text-ink/50">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.id} className="border-b border-ink/8 transition-colors last:border-b-0 hover:bg-paper">
                    <td className="px-7 py-5">
                      <span className="flex flex-wrap items-center gap-3 text-[14px] font-medium">
                        {s.label}
                        {s.frozen && <Badge tone="pending">frozen</Badge>}
                      </span>
                    </td>
                    <td className="px-7 py-5 font-mono text-[13px]">{formatCtc(s.staked, 2)}</td>
                    <td className="px-7 py-5 font-mono text-[13px] text-ink/60">{formatCtc(s.premiums, 4)}</td>
                    <td className="px-7 py-5 font-mono text-[13px] text-ink/60">{formatCtc(s.paidOut, 2)}</td>
                    <td className="px-7 py-5 font-mono text-[13px] text-ink/50">
                      {formatCtc(s.payoutCapPerBlock, 0)}
                    </td>
                    <td className="px-7 py-5 text-right">
                      <Link href={`/subjects/${s.id}`}>
                        <ArrowLink>Manage</ArrowLink>
                      </Link>
                    </td>
                  </tr>
                ))}
                {subjects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-7 py-14 text-center text-[13px] text-ink/50">
                      No subjects registered.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

        <div className="grid gap-12 lg:grid-cols-2">
          <Section title="Your positions">
            {!isConnected ? (
              <p className="text-[14px] leading-relaxed text-ink/50">
                Connect a wallet to see what you hold. Everything else on this page reads without one.
              </p>
            ) : held.length === 0 ? (
              <p className="text-[14px] leading-relaxed text-ink/50">
                Nothing yet. Open a subject to buy cover or stake against it.
              </p>
            ) : (
              <div className="space-y-4">
                {held.map((p) => (
                  <div
                    key={p.subject.id}
                    className="flex flex-wrap items-center justify-between gap-5 rounded-md border border-ink/12 px-6 py-5"
                  >
                    <Link href={`/subjects/${p.subject.id}`} className="text-[14px] font-medium hover:underline">
                      {p.subject.label}
                    </Link>
                    <div className="flex gap-8 font-mono text-[12.5px]">
                      {p.stake > 0n && (
                        <span>
                          <span className="text-ink/50">staked </span>
                          {formatCtc(p.stake, 4)}
                        </span>
                      )}
                      {p.cover > 0n && (
                        <span className="text-settled">
                          <span className="text-ink/50">covered </span>
                          {formatUsd(p.cover)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Prosecutors" aside={<span className="label text-ink/45">by bounties earned</span>}>
            <p className="mb-7 max-w-[52ch] text-[14px] leading-relaxed text-ink/50">
              Bounties earned for delivering proofs. The worker is open source &mdash; anyone can run
              one, and anyone who does can collect.
            </p>
            {(leaderboard.data ?? []).length === 0 ? (
              <Empty title={offline ? 'Unavailable' : 'No bounties claimed yet'}>
                {offline ? 'The worker keeps this record.' : 'The first proof delivered earns the first bounty.'}
              </Empty>
            ) : (
              <div>
                {(leaderboard.data ?? []).map((row, i) => (
                  <div
                    key={row.address}
                    className="flex items-center justify-between gap-5 border-b border-ink/8 py-4 last:border-b-0"
                  >
                    <span className="flex items-center gap-4">
                      <span className="font-mono text-[11px] text-ink/30">{String(i + 1).padStart(2, '0')}</span>
                      <span className="font-mono text-[13px]">{shortHash(row.address)}</span>
                    </span>
                    <span className="font-mono text-[11px] text-ink/35">{row.submissions} submitted</span>
                    <span className="font-mono text-[13px] text-accent-deep">
                      {formatCtc(BigInt(row.bountiesWei), 4)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
