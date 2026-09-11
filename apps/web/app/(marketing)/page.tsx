import Link from 'next/link';
import type { ReactNode } from 'react';
import { Bento, DoorCard } from '@/components/ui';
import { HeroBlock } from '@/components/landing/HeroBlock';
import { LiveProof } from '@/components/landing/LiveProof';

/**
 * The first thing anyone sees.
 *
 * It is built as an argument in five moves — the blindness, the insight, the engine,
 * the admission, the way in — because Watchtower is not a familiar product category
 * and a feature grid would teach nobody anything. The reader should be able to state
 * the thesis back in one sentence before they are offered a button.
 *
 * Two design rules govern this page. Nothing is magenta unless the chain proved it,
 * and the highlighter is spent exactly twice — on the claim in the headline and on
 * the coordinate the whole system turns on. Everything else that is accented is
 * accented as type. And the page alternates paper and ink bands, so scrolling it
 * feels like turning over a printed sheet rather than falling down a feed.
 */
export default function LandingPage() {
  return (
    <>
      {/* ============================================================ hero */}
      <section className="ruled relative overflow-hidden">
        {/*
          The spine: a rotated mark running up the left gutter, as on a spec sheet.
          It sits in the gutter beside the type rather than in a band above it, which
          is why it reads as editorial furniture and the strip that used to be at the
          top did not — that one put a rule a few pixels under the navbar's own
          border and the pair read as one thick double line.
        */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-5 top-1/2 hidden -translate-y-1/2 -rotate-90 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.4em] text-ink/30 xl:block"
        >
          Proof-native insurance · Ethereum → Creditcoin
        </span>

        <div className="shell pb-24 pt-24 md:pb-32 md:pt-32">
          {/* --------------------------------------------------- headline */}
          <h1 className="display text-[clamp(2.75rem,8vw,6.75rem)]">
            Ethereum cannot see
            <br />
            its own block.
          </h1>

          <p className="mt-10 flex justify-end">
            <span className="display text-[clamp(1.75rem,5.5vw,4rem)]">
              Creditcoin <span className="mark-proven">can.</span>
            </span>
          </p>

          {/* ----------------------------------------------------- figure */}
          <div className="mt-20 md:mt-24">
            <HeroBlock />
          </div>

          {/* -------------------------------------------- lede and the way in */}
          <div className="mt-24 grid gap-10 border-t border-ink/15 pt-12 md:mt-32 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <p className="max-w-[54ch] text-[clamp(1.05rem,1.6vw,1.375rem)] leading-relaxed text-ink/70">
              A contract on Ethereum cannot observe the transactions beside it.{' '}
              <span className="text-ink">Watchtower is insurance that pays out when Ethereum takes
              your money</span> &mdash; and it never takes your word for it. Every claim is a
              cryptographic proof, verified on Creditcoin, priced and settled in a single block.
            </p>

            <div className="flex flex-wrap items-start gap-3 lg:justify-end">
              <Link
                href="/dashboard"
                className="rounded-md border border-accent bg-accent px-7 py-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink transition-colors hover:border-accent-deep hover:bg-accent-deep hover:text-paper"
              >
                See it running
              </Link>
              <a
                href="#problem"
                className="rounded-md border border-ink/25 px-7 py-4 font-mono text-[11px] uppercase tracking-[0.14em] text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper"
              >
                How it works
              </a>
            </div>
          </div>

          <p className="mt-14 border-t border-ink/12 pt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-ink/50">
            No claims adjuster · No oracle operator · No multisig · No trusted watcher
          </p>
        </div>
      </section>

      <LiveProof />

      {/* ========================================================= problem */}
      <section id="problem" className="shell py-28 md:py-40">
        <Heading
          eyebrow="The problem"
          title="Two failures. One shape."
          lede="Both are facts about Ethereum that Ethereum itself cannot act on. The evidence exists. It is simply unreachable from inside the chain."
        />

        {/*
          One line, two nodes, opposite sides. The spine is the "one shape" the
          heading promises — the two failures are not a pair of boxes sitting beside
          each other, they are two points on the same axis, and the layout is now
          making that argument rather than the copy alone.
        */}
        <div className="relative mt-20 md:mt-24">
          <span
            aria-hidden
            className="pointer-events-none absolute -top-10 bottom-0 left-3 w-px bg-ink/20 md:-bottom-10 md:left-1/2 md:-translate-x-1/2"
          />

          <FailureNode
            side="left"
            step="01"
            title="A searcher brackets your swap"
            body="A front-run, your trade and a back-run, at consecutive positions in one block. The proof is sitting in the block — and no Ethereum contract can read it."
            figure={`block 25,955,190
29   searcher   buys
30   you        buy    ← worse price
31   searcher   sells`}
          />

          <FailureNode
            side="right"
            step="02"
            title="A custodian mints what it never locked"
            body="A bridge or a custodian issues more than it holds. Any indexer can see it. Nobody can enforce it."
            figure={`custodian 0x4044…A5eF
locked      1,000
minted      2,000
shortfall   1,000   enforceable by nobody`}
          />
        </div>

        <p className="mt-14 max-w-[58ch] text-[clamp(1.05rem,1.6vw,1.375rem)] leading-relaxed text-ink/55">
          Today&rsquo;s answer to both is to trust someone.{' '}
          <span className="text-ink">
            That is the single point of failure the Attestcoin Protocol deletes.
          </span>
        </p>
      </section>

      {/* ========================================================= insight */}
      <section id="insight" className="relative overflow-hidden border-y border-ink/15 bg-paper-dim">
        <div className="dot-field absolute inset-0 opacity-40" aria-hidden />

        <div className="shell relative py-28 md:py-40">
          <div className="mx-auto max-w-4xl text-center">
            <p className="label mb-8 text-ink/45">The insight</p>
            <h2 className="display text-[clamp(2.25rem,6vw,4.5rem)]">
              Creditcoin reads Ethereum
              <br />
              differently.
            </h2>

            <p className="mx-auto mt-10 max-w-[62ch] text-[clamp(1rem,1.5vw,1.1875rem)] leading-relaxed text-ink/65">
              The block prover precompile at{' '}
              <code className="rounded-sm border border-accent/40 px-1.5 py-0.5 font-mono text-[0.9em] text-accent-deep">0x0FD2</code> will verify{' '}
              <em>any</em> Ethereum transaction. Nothing binds that transaction to your dApp &mdash;
              so a Creditcoin contract can adjudicate facts about other people&rsquo;s protocols. And
              the Merkle sibling path encodes where the transaction sat inside its block.
            </p>
          </div>

          <blockquote className="mx-auto mt-20 max-w-5xl border-y border-ink py-14 text-center">
            <p className="display text-[clamp(1.5rem,4.2vw,3.25rem)]">
              &ldquo;A Creditcoin contract can see what an
              <br className="hidden md:block" /> Ethereum contract cannot: its neighbours.&rdquo;
            </p>
          </blockquote>

          <p className="mx-auto mt-16 max-w-[64ch] text-center text-[15px] leading-relaxed text-ink/55">
            Combine that with batch proofs &mdash; up to ten transactions sharing one continuity
            proof &mdash; and a contract can prove statements about Ethereum&rsquo;s execution order
            and history.{' '}
            <span className="text-ink">Synchronously, on-chain, for a fraction of a cent.</span>
          </p>
        </div>
      </section>

      {/* ========================================================== engine */}
      <section id="engine" className="shell py-28 md:py-40">
        <Heading
          eyebrow="The engine"
          title="One coordinate runs everything"
          lede={
            <>
              Everything Watchtower protects is a <strong className="font-semibold text-ink">subject</strong>.
              Everything it knows how to prove is a <strong className="font-semibold text-ink">rule</strong>.
              Everything it pays comes out of one <strong className="font-semibold text-ink">vault</strong>.
            </>
          }
        />

        <p className="mt-12 font-mono text-[clamp(1.125rem,3vw,2rem)] tracking-tight">
          <span className="mark-proven">(chainKey, blockHeight, txIndex)</span>
        </p>

        {/* The rule library, set as a printed table rather than four cramped cards. */}
        <div className="mt-20 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-y border-ink">
                <th className="label py-4 pr-6 font-normal text-ink/45">Rule</th>
                <th className="label py-4 pr-6 font-normal text-ink/45">What it proves</th>
                <th className="label py-4 pr-6 font-normal text-ink/45">Evidence window</th>
                <th className="label py-4 font-normal text-ink/45">Settlement</th>
              </tr>
            </thead>
            <tbody>
              <RuleRow
                name="IntraBlockExtraction"
                claim="A searcher bracketed a victim's swap, on one pool, in one block."
                window="3 adjacent indices"
                settlement="Instant"
                instant
              />
              <RuleRow
                name="ReserveConservation"
                claim="A custodian minted more than it locked, rebuilt from proven events."
                window="Ordered stream ≤ 10"
                settlement="Optimistic"
              />
              <RuleRow
                name="ChainlinkFeed"
                claim="The price Chainlink itself published — proven, not reported."
                window="Ordered stream"
                settlement="Source rule"
              />
              <RuleRow
                name="FailedTx"
                claim="A transaction reverted and burned gas for nothing."
                window="Single transaction"
                settlement="Instant"
                instant
              />
            </tbody>
          </table>
        </div>

        <p className="mt-6 font-mono text-[12px] text-ink/50">
          Four rules, one engine. Adding a fifth risk means writing one pure function.
        </p>

        <div className="mt-20 grid gap-10 lg:grid-cols-[1.25fr_1fr]">
          <div className="rounded-lg border border-ink/15 bg-card p-8 md:p-10">
            <p className="label mb-8 text-ink/45">What happens inside one call</p>
            <ol className="space-y-4">
              {[
                ['verify the whole window against the precompile', false],
                ['derive each txIndex from its Merkle path', false],
                ['decode receipt status and transaction fields', false],
                ['rule-scoped replay guard', true],
                ['enforce the evidence-window shape the rule declared', false],
                ['rule.evaluate() — pure, no state, no money', false],
                ['apply the accumulator delta', false],
                ['if violated → UnderwritingVault.settle()', true],
              ].map(([step, accent], i) => (
                <li key={i} className="flex gap-5 font-mono text-[13px] leading-relaxed">
                  <span className="shrink-0 text-ink/30">{String(i + 1).padStart(2, '0')}</span>
                  <span className={accent ? 'text-accent-deep' : 'text-ink/65'}>{step as string}</span>
                </li>
              ))}
            </ol>
            <p className="mt-10 max-w-[62ch] border-t border-ink/12 pt-7 text-[14px] leading-relaxed text-ink/55">
              Rules hold no state and touch no money &mdash; they are reached by STATICCALL, so a
              rule that tries to write reverts. A buggy or hostile rule can mis-judge one incident,
              bounded by the subject&rsquo;s payout cap, but can never drain the vault. That is what
              makes an open rule library safe to accept from third parties.
            </p>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-lg border border-ink/15 bg-card p-8 md:p-10">
              <p className="label mb-5 text-ink/45">For underwriters</p>
              <p className="text-[15px] leading-relaxed text-ink/65">
                Stake CTC to a subject&rsquo;s tranche and earn premiums. Your risk is legible: you
                can read the rule that decides whether you pay.
              </p>
            </div>
            <div className="rounded-lg border border-ink/15 bg-card p-8 md:p-10">
              <p className="label mb-5 text-ink/45">For anyone with a laptop</p>
              <p className="text-[15px] leading-relaxed text-ink/65">
                Run a prosecutor. Spot a violation, build the proof, submit it, take the bounty.
                Bounties are funded by policyholders and by anyone who wants a contract watched.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================== honest */}
      <section id="honest" className="ruled-ink border-y border-ink bg-ink text-paper">
        <div className="shell py-28 md:py-40">
          <div className="max-w-4xl">
            <p className="label mb-8 text-paper/40">The part that makes it honest</p>
            <h2 className="display text-[clamp(2.25rem,6vw,4.25rem)] text-paper">
              You cannot prove
              <br />a negative on-chain.
            </h2>
            <p className="mt-8 max-w-[62ch] text-[17px] leading-relaxed text-paper/55">
              So we do not pretend to. Watchtower knows exactly which of its claims are self-evident
              and which are economically secured.
            </p>
          </div>

          <div className="mt-20 grid gap-px overflow-hidden rounded-lg border border-paper/15 bg-paper/15 md:grid-cols-2">
            <article className="bg-ink p-8 md:p-10">
              <header className="mb-7 flex items-center justify-between gap-4">
                <h3 className="display text-2xl text-paper">Intra-block claims</h3>
                <span className="shrink-0 rounded-md bg-accent px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink">
                  Instant
                </span>
              </header>
              <p className="text-[15px] leading-relaxed text-paper/55">
                A sandwich claim carries all of its own evidence: three proofs, one block,
                consecutive positions. Nothing outside the window can change the verdict, so there is
                nothing to challenge. It settles in the same transaction.
              </p>
            </article>

            <article className="bg-ink p-8 md:p-10">
              <header className="mb-7 flex items-center justify-between gap-4">
                <h3 className="display text-2xl text-paper">Stream claims</h3>
                <span className="shrink-0 rounded-md border border-paper/35 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-paper/70">
                  Optimistic
                </span>
              </header>
              <p className="text-[15px] leading-relaxed text-paper/55">
                Solvency depends on <em>completeness</em> &mdash; on no relevant event having been
                skipped. No proof system can demonstrate an absence, so the accumulator advances on a
                bonded submission and the payout unlocks after a challenge window.
              </p>
            </article>
          </div>

          <div className="mt-12 grid gap-12 lg:grid-cols-2">
            <div>
              <p className="label mb-5 text-accent">The defence</p>
              <p className="text-[15px] leading-relaxed text-paper/55">
                Anyone who proves a matching transaction whose coordinate falls inside the range a
                prosecutor claimed to have covered rolls the accumulator back and takes their bond.
                And that gap challenge is itself just another evidence submission, one transaction
                wide.{' '}
                <span className="text-paper">Watchtower&rsquo;s fraud proof runs on Watchtower.</span>
              </p>
            </div>

            <div>
              <p className="label mb-5 text-paper/40">What we admit up front</p>
              <ul className="space-y-3 font-mono text-[12.5px] leading-relaxed text-paper/50">
                <li className="flex gap-3">
                  <span className="text-paper/25">→</span>Attestation takes about eight minutes end
                  to end. Fast, not instant.
                </li>
                <li className="flex gap-3">
                  <span className="text-paper/25">→</span>No state proofs exist. Every balance is
                  replayed from a proven event stream.
                </li>
                <li className="flex gap-3">
                  <span className="text-paper/25">→</span>Stream verdicts are economically secured,
                  not self-evident.
                </li>
                <li className="flex gap-3">
                  <span className="text-paper/25">→</span>Ten transactions per batch, 1000-block
                  range. Single-block MEV in v1.
                </li>
                <li className="flex gap-3">
                  <span className="text-paper/25">→</span>Ethereum only today. Writability is in
                  audit; we demo without it.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================== entry */}
      <section className="shell py-28 md:py-40">
        <div className="max-w-3xl">
          <p className="label mb-6 text-ink/45">The way in</p>
          <h2 className="display text-[clamp(2.25rem,6vw,4.25rem)]">Three ways in.</h2>
          <p className="mt-7 max-w-[52ch] text-[17px] leading-relaxed text-ink/60">
            The whole application reads without a wallet. Only spending needs one.
          </p>
        </div>

        <Bento className="mt-20">
          <DoorCard
            span="md:col-span-5"
            href="/subjects"
            step="01"
            title="Buy cover"
            body="Pick a risk you are exposed to and take out cover on it. You never file a claim, because the claim is the proof."
            cta="Browse subjects"
          />
          <DoorCard
            span="md:col-span-7"
            tone="ink"
            href="/vault"
            step="02"
            title="Underwrite"
            body="Stake CTC against a subject's risk, earn the premiums written while you back it, and withdraw when nothing is in dispute."
            cta="Open the vault"
          />
          <DoorCard
            span="md:col-span-12"
            wide
            href="/prosecute"
            step="03"
            title="Prosecute"
            body="Paste an Ethereum transaction. If it proves a violation, the verdict settles on Creditcoin and the bounty is yours — no permission, no account, no wallet unless you want the bounty in your own name."
            cta="File evidence"
          />
        </Bento>

        <div className="mt-16 flex justify-center">
          <Link
            href="/dashboard"
            className="rounded-md border border-accent bg-accent px-10 py-5 font-mono text-[12px] uppercase tracking-[0.16em] text-ink transition-colors hover:border-accent-deep hover:bg-accent-deep hover:text-paper"
          >
            Open the dashboard
          </Link>
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ pieces */

function Heading({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: ReactNode }) {
  return (
    <div className="max-w-4xl">
      <p className="label mb-6 text-ink/45">{eyebrow}</p>
      <h2 className="display text-[clamp(2.25rem,6vw,4.25rem)]">{title}</h2>
      {lede && (
        <p className="mt-8 max-w-[60ch] text-[clamp(1rem,1.5vw,1.1875rem)] leading-relaxed text-ink/60">
          {lede}
        </p>
      )}
    </div>
  );
}

/**
 * One failure, as a node on the spine.
 *
 * The marker is the step number sitting in a break in the line rather than a dot on
 * it — the line is masked by the numeral's own background, so the interruption costs
 * no extra element. A hairline reaches from the numeral to the block it belongs to,
 * which is the same leader-line device the hero uses to label a transaction index.
 *
 * The left-hand node sets its prose flush right so it hugs the spine, but its
 * evidence stays left-aligned inside a right-pushed block: that figure is a table,
 * and a table whose columns are ragged is no longer a table.
 */
function FailureNode({
  side,
  step,
  title,
  body,
  figure,
}: {
  side: 'left' | 'right';
  step: string;
  title: string;
  body: string;
  figure: string;
}) {
  const left = side === 'left';

  return (
    <article
      className={`relative grid pb-4 pl-12 md:grid-cols-2 md:gap-x-20 md:pl-0 ${
        left ? '' : 'mt-16 md:mt-28'
      }`}
    >
      {/* The numeral, masking the spine it sits on. */}
      <span
        aria-hidden
        className="absolute left-3 top-0 z-10 -translate-x-1/2 bg-paper px-2.5 font-mono text-[15px] font-bold leading-[1.25] tracking-tight md:left-1/2"
      >
        {step}
      </span>

      {/* The leader from the node out to its block. */}
      <span
        aria-hidden
        className={`absolute top-[0.6rem] hidden h-px w-12 bg-ink/20 md:block ${
          left ? 'right-1/2 mr-5' : 'left-1/2 ml-5'
        }`}
      />

      <div className={left ? 'md:col-start-1 md:text-right' : 'md:col-start-2'}>
        <p className="label mb-6 text-breach">Failure {step}</p>
        <h3 className={`display text-[clamp(1.5rem,2.8vw,2.125rem)] ${left ? 'md:ml-auto' : ''} max-w-[16ch]`}>
          {title}
        </h3>
        <p
          className={`mt-6 max-w-[46ch] text-[15px] leading-relaxed text-ink/60 ${
            left ? 'md:ml-auto' : ''
          }`}
        >
          {body}
        </p>
        <pre
          className={`mt-8 w-fit max-w-full overflow-x-auto border-t border-ink/12 pt-6 text-left font-mono text-[11.5px] leading-relaxed text-ink/55 ${
            left ? 'md:ml-auto' : ''
          }`}
        >
          {figure}
        </pre>
      </div>
    </article>
  );
}

function RuleRow({
  name,
  claim,
  window,
  settlement,
  instant,
}: {
  name: string;
  claim: string;
  window: string;
  settlement: string;
  instant?: boolean;
}) {
  return (
    <tr className="border-b border-ink/12 align-top transition-colors hover:bg-card">
      <td className="py-7 pr-6">
        <span className="font-mono text-[14px] font-medium">{name}</span>
      </td>
      <td className="max-w-[38ch] py-7 pr-6 text-[14px] leading-relaxed text-ink/60">{claim}</td>
      <td className="py-7 pr-6">
        <span className="font-mono text-[12.5px] text-ink/70">{window}</span>
      </td>
      <td className="py-7">
        <span
          className={`font-mono text-[12.5px] ${instant ? 'text-accent-deep' : 'text-ink/70'}`}
        >
          {settlement}
        </span>
      </td>
    </tr>
  );
}
