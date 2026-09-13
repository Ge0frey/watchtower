import type { DocSection } from '../schema';
import { A, C, S } from '@/components/docs/DocBody';

export const using: DocSection = {
  title: 'Using Watchtower',
  pages: [
    /* ==================================================================== */
    {
      slug: 'dashboard',
      title: 'Reading the dashboard',
      lede: 'What every number on the screen is, where it came from, and which ones you should not trust.',
      keywords: ['dashboard', 'header', 'rail', 'proven head', 'cursor', 'live', 'wallet', 'connect'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              <A href="/dashboard">/dashboard</A> is where the application starts. It answers three
              questions in order: what has the system proven, what is it watching, and what did it last
              judge.
            </>
          ),
        },

        { kind: 'h2', text: 'The ink rail' },
        {
          kind: 'p',
          children: (
            <>
              Three readings sit in the chrome on every route, so ambient state never costs you a
              navigation.
            </>
          ),
        },
        {
          kind: 'terms',
          items: [
            {
              term: 'Proven head',
              body: (
                <>
                  The exact <C>(block, index)</C> this system has verified up to. Not the Ethereum
                  head — the head <S>Watchtower can prove</S>. How current the evidence is matters as
                  much as the numbers.
                </>
              ),
            },
            {
              term: 'ETH/USD',
              body: (
                <>
                  Proven from Chainlink&rsquo;s own <C>AnswerUpdated</C> transaction by the feed
                  subject. It is the price every dollar figure in the application resolves through.
                </>
              ),
            },
            {
              term: 'Prosecutor',
              body: (
                <>
                  The worker&rsquo;s hot-key balance. It goes red before anything actually fails, which
                  is the point — a prosecutor out of CTC stops proving things quietly otherwise.
                </>
              ),
            },
          ],
        },
        {
          kind: 'note',
          tone: 'neutral',
          title: 'Nothing on this screen blinks',
          children: (
            <>
              There is no pulse, no breathing dot and no live indicator anywhere in the application. A
              live system proves it is live by changing its numbers. If the rail is moving, the system
              is working.
            </>
          ),
        },

        { kind: 'h2', text: 'Which numbers decide money' },
        {
          kind: 'table',
          head: ['Shown', 'Source', 'Authority'],
          rows: [
            [
              'Reserves, cover, stakes, payout caps, proven head, price',
              'Creditcoin, by viem multicall, every 3s',
              'Authoritative',
            ],
            ['Incident history, decoded evidence, candidates, leaderboard', 'worker REST', 'Presentation only'],
            ['Live pipeline narration', 'worker SSE', 'Presentation only'],
            ['Cover, staking, bounties, challenges, self-prosecution', 'your wallet', 'User-signed'],
          ],
        },
        {
          kind: 'statement',
          children: <>If the chain and the API ever disagree, the chain wins.</>,
        },
        {
          kind: 'p',
          children: (
            <>
              One <C>useChainState</C> query is shared through TanStack Query&rsquo;s cache, so moving
              between pages reuses a single batched read rather than starting another.
            </>
          ),
        },

        { kind: 'h2', text: 'Connecting a wallet' },
        {
          kind: 'bullets',
          items: [
            <>
              Watchtower is an <S>EVM</S> application. Use MetaMask or Rabby — <S>not Phantom</S>.
              Wallets are found by EIP-6963 auto-discovery, so there is nothing to configure.
            </>,
            <>
              On the wrong network, the application says so and offers one click that adds{' '}
              <S>Creditcoin CC3 Testnet (102031)</S> to the wallet and switches to it.
            </>,
            <>
              Every page renders with no wallet connected. Only buying cover, staking, claiming
              premiums, funding a watch, challenging and self-signed prosecution need one.
            </>,
          ],
        },

        { kind: 'h2', text: 'When the worker is down' },
        {
          kind: 'p',
          children: (
            <>
              Worth knowing, because it is most of the application. A cold worker takes 30–60 seconds
              to answer — it verifies the chain id and the protocol&rsquo;s chain mapping before the
              API binds — and the warm-up panel narrates that wait with real block numbers.
            </>
          ),
        },
        {
          kind: 'table',
          head: ['Still works', 'Does not'],
          rows: [
            ['Landing page and its live numbers', 'The incident feed'],
            ['/subjects — catalogue, accumulators, tranches, bounty pools', '/prosecute — proof building lives in the worker'],
            ['/vault — everything but the leaderboard', 'The leaderboard'],
            ['Buying cover, staking, claiming premiums, funding a watch, challenging', 'Live SSE narration'],
          ],
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'buy-cover',
      title: 'Buy cover',
      lede: 'Protection against something provable. One signature, and then you never file a claim.',
      keywords: ['cover', 'buy', 'policy', 'premium', 'beneficiary', 'restitution', 'holder'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              <S><A href="/subjects">/subjects</A> → open one → Buy cover.</S>
            </>
          ),
        },

        { kind: 'h2', text: 'Read the subject first' },
        {
          kind: 'p',
          children: (
            <>
              The subject page tells you what its rule actually proves, what the chain currently says
              about it — reserve ratio for a custodian, payouts to date for a pool — how much capital
              stands behind it, the per-block payout cap, and the <S>proven head</S>: the exact{' '}
              <C>(block, index)</C> the system has verified up to.
            </>
          ),
        },
        {
          kind: 'note',
          tone: 'proven',
          title: 'Freshness is part of the product',
          children: (
            <>
              Cover on a subject whose cursor is two thousand blocks behind is cover against something
              the system cannot currently see. That is why the proven head is on the subject page, at
              the same weight as the money.
            </>
          ),
        },

        { kind: 'h2', text: 'The premium' },
        {
          kind: 'p',
          children: (
            <>
              Enter a dollar amount. The premium is <S>1% of cover per 30 days</S>, quoted by reading{' '}
              <C>usdToCtc</C> from the vault and applying the contract&rsquo;s own formula — so the
              figure shown is the figure the contract will demand, not an estimate the frontend
              computed. One signature, on Creditcoin.
            </>
          ),
        },

        { kind: 'h2', text: 'Then nothing' },
        {
          kind: 'statement',
          children: <>You never file a claim, because the claim is the proof.</>,
        },
        {
          kind: 'p',
          children: (
            <>
              If the rule is ever proven against that subject and you are the beneficiary, restitution
              arrives in your wallet. There is no form, no adjuster and no waiting period — the same
              transaction that proves the incident moves the money.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              The payout is capped three ways and the smallest wins: <S>your cover</S>, the{' '}
              <S>subject&rsquo;s staked tranche</S>, and the <S>per-block payout cap</S>.
            </>
          ),
        },

        { kind: 'h2', text: 'What to know before you buy' },
        {
          kind: 'bullets',
          items: [
            <>
              <S>Cover is per subject, not per position size.</S> A $2 policy pays at most $2,
              regardless of how much you were actually trading.
            </>,
            <>
              <S>On a custodian, the first buyer is the beneficiary.</S>{' '}
              <C>ReserveConservation</C> returns no explicit beneficiary and <C>primaryHolder</C> is
              first-come-first-served, so a second buyer on the same custodian would not be paid from a
              breach. Sandwich and failed-transaction verdicts name their beneficiary directly and are
              unaffected.
            </>,
            <>
              A verdict can be correct and pay you nothing — if the victim proven in the evidence is
              not you. Insurance pays the insured.
            </>,
          ],
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'underwrite',
      title: 'Underwrite a subject',
      lede: 'Take the other side: premium income, in exchange for payout risk on one specific thing.',
      keywords: ['stake', 'underwrite', 'tranche', 'premium', 'unstake', 'claimPremiums', 'frozen'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              <S><A href="/vault">/vault</A> for the overview, <C>/subjects/[id]</C> to act.</S>
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              Stake CTC to a subject&rsquo;s tranche and premiums accrue as buyers arrive. Risk is{' '}
              <S>per subject</S> — backing a price feed does not expose you to a bridge, and a payout
              on one subject cannot reach capital staked to another.
            </>
          ),
        },

        { kind: 'h2', text: 'What you are taking on' },
        {
          kind: 'p',
          children: (
            <>
              Payouts on that subject come out of that tranche, bounded by the per-block payout cap.
              Read the rule before staking: an instant rule can pay in the same block it is proven,
              while an optimistic one gives you a challenge window in which a bad claim can still be
              overturned.
            </>
          ),
        },

        { kind: 'h2', text: 'Premiums' },
        {
          kind: 'p',
          children: (
            <>
              Premiums accrue per unit of stake at the moment cover is bought. <C>claimPremiums</C>{' '}
              pays out what your stake has earned <S>without withdrawing the stake</S>, and unstaking
              carries the accrued premiums automatically — you cannot leave them behind by accident.
            </>
          ),
        },

        { kind: 'h2', text: 'Exiting' },
        {
          kind: 'note',
          tone: 'pending',
          title: 'Frozen during a dispute',
          children: (
            <>
              Withdrawals are blocked while that subject has an unresolved breach — underwriters
              cannot exit between a proven violation and its settlement. The panel says{' '}
              <C>frozen: this subject has an unresolved breach</C> rather than greying the button out
              with no reason.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              Open breaches are <S>counted, not flagged</S>: a stream can break twice before anyone
              settles the first claim, and a boolean would have thawed the tranche after the first
              payout while the second was still open.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              Beyond that check there is <S>no cooldown</S>. An underwriter can exit right up until a
              breach is proven. It is a known limit, listed on{' '}
              <A href="/docs/limits">Limits</A> rather than left to be discovered.
            </>
          ),
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'fund-a-watch',
      title: 'Fund a watch',
      lede: 'Put money behind the idea that a particular contract should be watched.',
      keywords: ['bounty', 'fund', 'watch', 'sponsor', 'register', 'pnpm watch', 'pool'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              <S>Any subject page → Fund a watch.</S> The panel is one field and one signature, and it
              pays whoever proves something on that subject.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              Prosecutors are paid from per-subject bounty pools and <S>anyone can top one up</S>. It
              is how a protocol, a DAO or an individual says this contract matters and puts capital
              behind the claim, without needing anyone&rsquo;s permission to do it.
            </>
          ),
        },

        { kind: 'h2', text: 'What a bounty actually pays' },
        {
          kind: 'p',
          children: (
            <>
              Fresh evidence earns the full bounty; evidence past the 24-hour checkpoint cliff earns
              20% of it, because its continuity proof costs roughly ten times the gas. The schedule is
              read off the proof rather than off a clock — see{' '}
              <A href="/docs/bounties">Bounties &amp; continuity length</A>.
            </>
          ),
        },

        { kind: 'h2', text: 'Watching something new' },
        {
          kind: 'p',
          children: (
            <>
              If the contract is not a subject yet, one command registers it, links it to the proven
              ETH/USD feed, stakes and funds the bounty. It appears on the dashboard within one poll.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `pnpm watch 0xADDRESS --label "UniV2 DAI/WETH" --bounty 0.25 --stake 1`,
        },
        {
          kind: 'p',
          children: (
            <>
              Use it for a bridge or an account rather than a pool, where you already know the address.
              For a pool, <C>pnpm stage:sandwich</C> scans for one that is actually being sandwiched
              and calls <C>watch</C> for you — see <A href="/docs/scripts">Scripts</A>.
            </>
          ),
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'prosecute',
      title: 'Prosecute',
      lede: 'Turn three transaction hashes into a verdict on-chain. With a wallet, or without one.',
      keywords: ['prosecute', 'relayed', 'self-signed', 'calldata', 'sse', 'pipeline', 'attestation', 'bounty'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              <S><A href="/prosecute">/prosecute</A>.</S> Paste transaction hashes — three from one
              block reads as a sandwich, one reads as a failed transaction — pick a subject, and
              submit.
            </>
          ),
        },

        { kind: 'h2', text: 'Two modes' },
        {
          kind: 'terms',
          items: [
            {
              term: 'Relayed',
              body: (
                <>
                  The worker builds the proof, pays the gas, and takes the bounty.{' '}
                  <S>No wallet needed</S>, so anyone can try it — including a judge who has never
                  touched Creditcoin.
                </>
              ),
            },
            {
              term: 'Sign it myself',
              body: (
                <>
                  The worker returns ready-to-sign calldata, your wallet submits it on Creditcoin, and{' '}
                  <S>the bounty is yours</S>. The worker never holds your key and never sees your
                  transaction until it lands.
                </>
              ),
            },
          ],
        },
        {
          kind: 'statement',
          children: (
            <>
              Neither mode can forge anything. The worker only assembles proofs; the contract
              re-verifies every one inside the settling transaction, so a dishonest submission reverts
              rather than pays.
            </>
          ),
        },

        { kind: 'h2', text: 'The eight-minute floor' },
        {
          kind: 'p',
          children: (
            <>
              Attestation takes <S>about eight minutes end to end</S> — not the ~2-minute attestation
              cadence. That is a property of decentralised attestation, not a queue you are stuck
              behind, and it is not hidden behind a spinner. Every step is narrated live over SSE,
              because silence reads as a hang.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Pipeline narration',
          code: `waiting for attestation      the attestors have to commit the block first
building proof               Merkle proofs per transaction, one shared continuity proof
pre-flight                   read-only verify against the precompile - costs no gas
submitting                   eth_sendRawTransaction on Creditcoin
settled                      VerdictIssued, or BreachOpened with a challenge window`,
        },
        {
          kind: 'note',
          tone: 'proven',
          title: 'The pre-flight is free',
          children: (
            <>
              The precompile&rsquo;s read-only <C>verify</C> overloads let the worker check a bundle
              before spending a single unit of gas. The same surface powers{' '}
              <C>previewEvidence()</C>, which is how the dashboard can show you a verdict without a
              transaction.
            </>
          ),
        },

        { kind: 'h2', text: 'Finding something to prosecute' },
        {
          kind: 'p',
          children: (
            <>
              Which pools are being sandwiched changes week to week — the canonical UniV2 USDC/WETH
              pair can go thousands of blocks without one, because that flow moved to V3. Do not
              assume, scan:
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `pnpm find:sandwich --span 150     # look only: triples, pool, attacker, victim, amount
pnpm stage:sandwich               # look, register the pool, fund it, print a paste-ready link`,
        },
        {
          kind: 'p',
          children: (
            <>
              <C>find</C> tells you what happened. <C>stage</C> makes it prosecutable. Both flag any
              window the deployed rule cannot price, so you never paste one in and watch it decline.
            </>
          ),
        },

        { kind: 'h2', text: 'Warming a proof' },
        {
          kind: 'p',
          children: (
            <>
              The Proof Builder caches. Running <C>pnpm thesis</C> on a triple ahead of time means the
              bundle comes back with <C>cached: true</C> in seconds rather than being rebuilt while
              someone watches — which is the difference between a demo and a wait.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `pnpm thesis 0xFRONTRUN 0xVICTIM 0xBACKRUN`,
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'challenge',
      title: 'Challenge a claim',
      lede: 'Prove a prosecutor skipped something, roll their claim back, and take their bond.',
      keywords: ['challenge', 'gap', 'bond', 'slash', 'settle', 'breach', 'window', 'countdown'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              <S><C>/incidents/[id]</C> on an open breach.</S> The panel shows the challenge window as
              a countdown, the range the claim covered, and one field for the transaction you say was
              skipped.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              A solvency claim is never self-evident: it depends on the prosecutor having skipped
              nothing, and no on-chain check can establish that. Rather than pretend otherwise, such
              claims are bonded and left open. See <A href="/docs/challenges">Challenges &amp; the bond</A>{' '}
              for the mechanism.
            </>
          ),
        },

        { kind: 'h2', text: 'Filing one' },
        {
          kind: 'steps',
          items: [
            <>
              Find a transaction from that custodian that falls inside the range they claimed to cover
              and was not ingested.
            </>,
            <>
              Paste its hash into the challenge panel and sign. It is filed as an ordinary{' '}
              <C>SINGLE_TX</C> window through the same entrypoint as any other evidence.
            </>,
            <>
              If it verifies, the accumulator rolls back to its snapshot and the bond is yours —{' '}
              <C>challenge upheld — bond slashed</C>.
            </>,
          ],
        },
        {
          kind: 'note',
          tone: 'neutral',
          title: 'Staging one to try',
          children: (
            <>
              <C>pnpm demo:skip-gap</C> submits a deliberately incomplete stream step and prints the
              hash it stepped over. Paste that into the panel on the incident it just opened.
            </>
          ),
        },

        { kind: 'h2', text: 'Settling instead' },
        {
          kind: 'p',
          children: (
            <>
              Once the window closes unchallenged the panel turns into <C>ready to settle</C>, and{' '}
              <S>anyone</S> can call it: the payout goes through and the bond returns to the
              prosecutor. It is permissionless on purpose — a claim cannot be left in limbo by a
              prosecutor who lost interest.
            </>
          ),
        },
      ],
    },
  ],
};
