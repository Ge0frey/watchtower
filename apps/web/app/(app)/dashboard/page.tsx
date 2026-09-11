'use client';

import Link from 'next/link';
import { formatCtc, formatUsd } from '@watchtower/shared';
import { IncidentCard } from '@/components/IncidentCard';
import { SubjectTile } from '@/components/SubjectTile';
import {
  ArrowLink,
  Bento,
  BentoCard,
  DoorCard,
  Empty,
  Label,
  Notice,
  PageHead,
  SectionHead,
  Stat,
} from '@/components/ui';
import { deployed, useChainState } from '@/hooks/useChainState';
import { useIncidentFeed } from '@/hooks/useIncidentFeed';
import { useWorkerStatus } from '@/hooks/useWorkerStatus';

/**
 * The application's home: what the system has proven, where a newcomer should go,
 * what it is watching, and what it most recently judged — in that order, because that
 * is the order the questions arrive in.
 *
 * The three doors sit above the data on purpose. The numbers prove the system is
 * running; they do not tell a first-time visitor what they are supposed to do with
 * it, and a dashboard that answers only the first question is the thing that makes
 * people bounce.
 */
export default function DashboardPage() {
  const { data: subjects = [], isLoading } = useChainState();
  const { incidents, candidates, progress } = useIncidentFeed();
  const { offline } = useWorkerStatus();

  const feed = subjects.find((s) => s.kind === 2);
  const head = subjects.reduce<{ h: bigint; i: number } | null>(
    (best, s) => (s.cursorHeight > (best?.h ?? 0n) ? { h: s.cursorHeight, i: s.cursorIndex } : best),
    null,
  );

  const staked = subjects.reduce((sum, s) => sum + s.staked, 0n);
  const paidOut = subjects.reduce((sum, s) => sum + s.paidOut, 0n);
  const bounties = subjects.reduce((sum, s) => sum + s.bountyPool, 0n);
  const breaches = incidents.filter((i) => i.status === 'open');
  const inFlight = candidates.filter((c) => !['CONFIRMED', 'UNPROVABLE'].includes(c.state));

  return (
    <>
      <PageHead
        eyebrow="Live on Creditcoin CC3 Testnet"
        title="System overview"
        lede="Every number on this page is read straight from Creditcoin. History and decoded evidence come from the prosecutor worker; if the two ever disagree, the chain wins."
      />

      {!deployed && (
        <div className="mb-12">
          <Notice>
            No deployment configured. Set <code className="font-mono">NEXT_PUBLIC_WATCHTOWER_CORE</code>,{' '}
            <code className="font-mono">NEXT_PUBLIC_SUBJECT_REGISTRY</code> and{' '}
            <code className="font-mono">NEXT_PUBLIC_UNDERWRITING_VAULT</code>.
          </Notice>
        </div>
      )}

      {/* --------------------------------------------------------- ambient */}
      {/*
        The proven head is not one statistic among five — it is the number the whole
        product turns on, so it takes a cell six columns wide and two rows tall and
        the other four arrange themselves around it. A five-across row of identical
        tiles would have said they all matter equally, which is not true.
      */}
      <Bento mobileCols={2}>
        <BentoCard span="col-span-2 md:col-span-6 md:row-span-2">
          <div className="flex h-full min-h-[13rem] flex-col justify-between p-7 md:p-9">
            <Label>Proven head</Label>
            <div>
              <p className="font-mono text-[clamp(2.5rem,6vw,4.25rem)] leading-[0.9] tracking-tight text-accent-deep">
                {head && head.h > 0n ? Number(head.h).toLocaleString() : '—'}
              </p>
              <p className="mt-4 max-w-[40ch] font-mono text-[11.5px] leading-relaxed text-ink/45">
                {head && head.h > 0n
                  ? `index ${head.i} · the exact coordinate this system has verified up to`
                  : 'nothing ingested yet'}
              </p>
            </div>
          </div>
        </BentoCard>

        <div className="col-span-1 md:col-span-3">
          <Stat
            label="Proven ETH/USD"
            tone="proven"
            value={feed && feed.price > 0n ? formatUsd(feed.price) : '—'}
          />
        </div>
        <div className="col-span-1 md:col-span-3">
          <Stat label="Subjects watched" value={isLoading ? '…' : String(subjects.length)} />
        </div>
        <div className="col-span-1 md:col-span-3">
          <Stat
            label="Capital staked"
            value={formatCtc(staked, 2)}
            sub={`${formatCtc(bounties, 2)} in bounties`}
          />
        </div>
        <div className="col-span-1 md:col-span-3">
          <Stat
            label="Restitution paid"
            tone={paidOut > 0n ? 'settled' : 'neutral'}
            value={formatCtc(paidOut, 2)}
          />
        </div>
      </Bento>

      {breaches.length > 0 && (
        <div className="mt-8">
          <Notice
            tone="breach"
            title={`${breaches.length} open breach${breaches.length > 1 ? 'es' : ''}`}
          >
            A violation has been proven and bonded. Underwriters on that subject cannot withdraw
            until it settles or is challenged.
          </Notice>
        </div>
      )}

      {/* ------------------------------------------------------ three doors */}
      <section className="mt-16">
        <SectionHead eyebrow="Start here" title="What do you want to do?" />
        <Bento>
          <DoorCard
            compact
            span="md:col-span-4"
            href="/subjects"
            step="01"
            title="Protect something"
            body="Pick a risk you are exposed to and buy cover. You never file a claim."
            cta="Browse subjects"
          />
          <DoorCard
            compact
            tone="ink"
            span="md:col-span-4"
            href="/vault"
            step="02"
            title="Underwrite a risk"
            body="Stake CTC to a tranche and earn the premiums written while you back it."
            cta="Open the vault"
          />
          <DoorCard
            compact
            span="md:col-span-4"
            href="/prosecute"
            step="03"
            title="Prove a violation"
            body="Paste an Ethereum transaction, deliver the proof, take the bounty."
            cta="File evidence"
          />
        </Bento>
      </section>

      {/* -------------------------------------------------------- subjects */}
      <section className="mt-20">
        <SectionHead
          eyebrow="What Watchtower is watching"
          title="Subject health"
          aside={
            <Link href="/subjects">
              <ArrowLink>All subjects</ArrowLink>
            </Link>
          }
        />

        {subjects.length === 0 ? (
          <Empty title={isLoading ? 'Reading the registry…' : 'No subjects registered'}>
            {!isLoading && 'Register one with `pnpm watch <address>` to put Watchtower on a contract.'}
          </Empty>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {subjects.map((subject) => (
              <SubjectTile key={subject.id} subject={subject} />
            ))}
          </div>
        )}
      </section>

      {/* -------------------------------------------------------- pipeline */}
      {inFlight.length > 0 && (
        <section className="mt-20">
          <SectionHead eyebrow="The prosecutor is working" title="In flight" />
          <div className="space-y-3">
            {inFlight.map((candidate) => (
              <div
                key={candidate.id}
                className="flex flex-wrap items-center gap-5 border border-dashed border-ink/25 bg-card px-6 py-4"
              >
                <span className="font-mono text-[12.5px]">{candidate.id}</span>
                <span className="font-mono text-[11.5px] text-ink/45">
                  {progress[candidate.id] ?? candidate.state.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------- incidents */}
      <section className="mt-20">
        <SectionHead
          eyebrow="One card format for every verdict"
          title="Latest verdicts"
          aside={
            <Link href="/incidents">
              <ArrowLink>Full archive</ArrowLink>
            </Link>
          }
        />

        {incidents.length === 0 ? (
          <Empty title={offline ? 'Verdict history unavailable' : 'No incidents yet'}>
            {offline
              ? 'The prosecutor worker is not reachable. Everything above is read from Creditcoin and is current.'
              : 'The prosecutor is watching Ethereum. A verdict appears here the moment one is proven on Creditcoin.'}
          </Empty>
        ) : (
          <div className="space-y-6">
            {incidents.slice(0, 4).map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                subjectLabel={subjects.find((s) => s.id.toLowerCase() === incident.subjectId.toLowerCase())?.label}
                href={`/incidents/${incident.id}`}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
