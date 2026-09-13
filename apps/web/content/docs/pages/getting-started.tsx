import type { DocSection } from '../schema';
import { A, C, S } from '@/components/docs/DocBody';

export const gettingStarted: DocSection = {
  title: 'Getting started',
  pages: [
    /* ==================================================================== */
    {
      slug: '',
      title: 'Overview',
      lede: 'What Watchtower is, the one fact it is built on, and what it can prove today.',
      keywords: ['intro', 'thesis', 'what is watchtower', 'attestcoin', 'creditcoin', 'mev'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              Watchtower is <S>proof-native insurance for Ethereum, underwritten on Creditcoin</S>. It
              pays you when Ethereum costs you money, and it never takes your word for it. Every claim
              is a cryptographic proof of an Ethereum transaction, verified on Creditcoin by the
              Attestcoin Protocol&rsquo;s Block Prover Precompile, priced, and settled in a single
              block.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              There is no claims adjuster, no oracle operator, no multisig and no trusted watcher. The
              only party that can move money out of the vault is the contract itself, executing a rule
              that was written before the incident happened.
            </>
          ),
        },

        { kind: 'h2', text: 'The problem' },
        {
          kind: 'p',
          children: (
            <>
              Two things happen on Ethereum every day that Ethereum itself cannot act on. Both are
              provable. Neither is reachable from inside the source chain.
            </>
          ),
        },
        {
          kind: 'terms',
          items: [
            {
              term: 'Intra-block extraction',
              body: (
                <>
                  A searcher brackets your swap — a front-run, your trade and a back-run, at
                  consecutive positions in one block. The proof is sitting in the block, and{' '}
                  <S>no Ethereum contract can read it</S>. A contract cannot see the transactions
                  beside it in its own block.
                </>
              ),
            },
            {
              term: 'Custodian insolvency',
              body: (
                <>
                  A bridge or a custodian mints more than it locked. Any indexer can see it; nobody can
                  enforce it. Auditing a whole history inside one transaction is not something an
                  Ethereum contract can do either.
                </>
              ),
            },
          ],
        },
        {
          kind: 'p',
          children: (
            <>
              Today&rsquo;s answer to both is to trust someone — an operator, a committee, a watcher.
              That is the single point of failure the Attestcoin Protocol deletes.
            </>
          ),
        },

        { kind: 'h2', text: 'One coordinate' },
        {
          kind: 'p',
          children: (
            <>
              Both failures reduce to the same three numbers:{' '}
              <C>(chainKey, blockHeight, txIndex)</C>. The Attestcoin Protocol supplies all three, and
              the third one — <S>position inside the block</S> — is the reason this product can exist.
            </>
          ),
        },
        {
          kind: 'statement',
          children: (
            <>
              A Creditcoin contract can see what an Ethereum contract cannot: its neighbours.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              The precompile at <C>0x0FD2</C> will verify any Ethereum transaction, and it exposes{' '}
              <C>calculateTxIndex</C>, which returns a transaction&rsquo;s position inside its block.
              Combine that with batch proofs and a Creditcoin contract can prove statements about{' '}
              <S>Ethereum&rsquo;s execution order</S>. Watchtower turns that into insurance that pays
              out on proof alone. See <A href="/docs/attestcoin">Attestcoin Protocol</A> for the
              surfaces used and the round trip in full.
            </>
          ),
        },

        { kind: 'h2', text: 'What it proves today' },
        {
          kind: 'table',
          head: ['Rule', 'Claim', 'Window', 'Settlement'],
          rows: [
            [
              <C key="r">IntraBlockExtraction</C>,
              'A searcher bracketed a victim swap — three consecutive indices in one block, same pool, round trip in profit',
              '3 adjacent',
              'instant',
            ],
            [
              <C key="r">ReserveConservation</C>,
              'A custodian minted more than it locked',
              'ordered stream ≤ 10',
              'optimistic, challengeable',
            ],
            [
              <C key="r">ChainlinkFeed</C>,
              'The price Chainlink itself published — proven, not reported',
              'ordered stream',
              'source rule',
            ],
            [
              <C key="r">FailedTx</C>,
              'A transaction reverted and burned gas for nothing',
              '1',
              'instant',
            ],
          ],
        },
        {
          kind: 'p',
          children: (
            <>
              Four rules, one engine. A rule is a pure <C>view</C> function; adding a fifth risk means
              writing one. The engine is the product and the rules are the catalogue — see{' '}
              <A href="/docs/rules">Rules</A>.
            </>
          ),
        },

        { kind: 'h2', text: 'What is deliberately not trusted' },
        {
          kind: 'p',
          children: (
            <>
              Three components in this system could lie, and none of them can be believed. That is the
              whole security model, and it is worth reading before anything else.
            </>
          ),
        },
        {
          kind: 'bullets',
          items: [
            <>
              <S>The worker is untrusted.</S> It assembles proofs and pays gas. It cannot forge a
              verdict, because the precompile verifies everything inside the settling transaction. A
              lying worker gets a revert.
            </>,
            <>
              <S>Rules are untrusted.</S> <C>evaluate</C> is <C>view</C>, so the core reaches it by{' '}
              <C>STATICCALL</C>. A rule cannot write state or move money, and its worst case — a wrong
              judgement — is bounded by the subject&rsquo;s per-block payout cap.
            </>,
            <>
              <S>The frontend is untrusted.</S> Every number that decides money is read from
              Creditcoin directly. The worker API supplies history and enrichment only. If the two
              disagree, <S>the chain wins</S>.
            </>,
          ],
        },

        { kind: 'h2', text: 'Where things live' },
        {
          kind: 'code',
          caption: 'Repository',
          code: `contracts/            Foundry. The ASC, the rule library, the vault. 79 tests, fuzzed invariants.
packages/shared/      Chain config, rule ids, types, generated ABIs.
packages/attestcoin/  Every conversation with the protocol: SDK client, proofs, pre-flight, gas.
apps/prosecutor/      The worker: three scanners, one submission path, indexer, REST + SSE.
apps/web/             Next.js. A landing page that makes the argument, then the application.
fixtures/             Proof bundles captured from the live testnet, replayed by the test suite.`,
        },
        {
          kind: 'p',
          children: (
            <>
              <C>/</C> is the landing page — the argument, with two live numbers read off Creditcoin by
              your browser so the claim is checkable before anything is explained.{' '}
              <A href="/dashboard">/dashboard</A> is where the application starts.{' '}
              <S>Every page renders with no wallet connected.</S> Only spending needs one.
            </>
          ),
        },

        { kind: 'h2', text: 'Where to go next' },
        {
          kind: 'cards',
          items: [
            {
              href: '/docs/quickstart',
              title: 'Quickstart',
              body: 'Clone, configure, deploy and run the whole system on your own machine.',
            },
            {
              href: '/docs/end-to-end',
              title: 'The whole flow',
              body: 'Every path through the application, from landing page to money in a wallet.',
            },
            {
              href: '/docs/subjects',
              title: 'Subjects',
              body: 'The unit everything attaches to: cover, capital, bounties and rules.',
            },
            {
              href: '/docs/architecture',
              title: 'Architecture',
              body: 'Four planes, one entrypoint, and where each trust boundary sits.',
            },
          ],
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'quickstart',
      title: 'Quickstart',
      lede: 'From a fresh clone to a running dashboard prosecuting real Ethereum transactions.',
      keywords: ['install', 'pnpm', 'setup', 'forge', 'clone', 'run', 'local'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              Watchtower is a pnpm workspace with a Foundry project inside it. You need{' '}
              <S>Node 20+</S>, <S>pnpm 10</S>, and <S>Foundry</S> (<C>forge</C>, <C>cast</C>). Nothing
              else — the worker&rsquo;s default store is a JSON file, so there is no database to
              stand up.
            </>
          ),
        },

        { kind: 'h2', text: 'Install' },
        {
          kind: 'code',
          caption: 'Shell',
          code: `git clone <this repo> watchtower && cd watchtower
pnpm install
cp .env.example .env`,
        },
        {
          kind: 'note',
          tone: 'neutral',
          title: 'Read this before filling in .env',
          children: (
            <>
              There are twenty-odd values in that file, but only <S>three</S> are things you create.
              The rest are public addresses you look up once, or outputs the deploy scripts print for
              you. <A href="/docs/environment">Environment</A> walks through every one in the order
              they have to be filled.
            </>
          ),
        },

        { kind: 'h2', text: 'Run the offline suite first' },
        {
          kind: 'p',
          children: (
            <>
              The contract tests need no network and no keys. Run them before anything else — if they
              pass, the engine is sound and everything that follows is configuration.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `cd contracts && forge test        # 79 tests, no network
cd .. && pnpm typecheck           # every package and app`,
        },

        { kind: 'h2', text: 'Deploy' },
        {
          kind: 'p',
          children: (
            <>
              Two deployments in a fixed order, with an <C>.env</C> edit between them. Sepolia first,
              because the Creditcoin deployment reads the bridge address and its deployment height.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `cd contracts
forge script script/DeploySepolia.s.sol --rpc-url sepolia --broadcast
# paste DEMO_BRIDGE_SEPOLIA, DEMO_TOKEN_SEPOLIA, BRIDGE_ANCHOR_HEIGHT into .env

cd .. && pnpm deploy:creditcoin   # NOT forge script - see below
# paste the eleven printed values, then the NEXT_PUBLIC_ copies

pnpm seed                          # stake, cover and bounty pools`,
        },
        {
          kind: 'note',
          tone: 'breach',
          title: 'Not forge script, on Creditcoin',
          children: (
            <>
              Creditcoin&rsquo;s RPC omits <C>mixHash</C> from block headers, so alloy cannot
              deserialise a block and <C>forge script</C> fails. The dangerous part is how it fails: it
              broadcasts transactions it can then no longer track, leaving a half-deployed system.{' '}
              <A href="/docs/deploy">Deploying</A> has the full reasoning and the idempotent
              replacement.
            </>
          ),
        },

        { kind: 'h2', text: 'Verify the integration, not the docs' },
        {
          kind: 'p',
          children: (
            <>
              Two checks confirm the protocol integration against the live chain. The first is what
              makes the entire offline test suite trustworthy.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `pnpm verify:precompile                        # ask 0x0FD2 to derive indices
pnpm thesis 0xFRONTRUN 0xVICTIM 0xBACKRUN     # a real mainnet sandwich, step by step`,
        },
        {
          kind: 'code',
          caption: 'Output',
          code: `Block Prover Precompile 0x0FD2 on chainId 102031
  expected   46   precompile   46   MATCH
  expected   47   precompile   47   MATCH
  expected   48   precompile   48   MATCH
  ...
The precompile uses the same convention as MockBlockProver.
The offline unit suite is faithful to on-chain behaviour.`,
        },

        { kind: 'h2', text: 'Run it' },
        {
          kind: 'code',
          caption: 'Two terminals',
          code: `pnpm worker    # prosecutor: scanners, indexer, REST + SSE on :8080
pnpm web       # dashboard on :3000`,
        },
        {
          kind: 'p',
          children: (
            <>
              The worker asserts its own assumptions at boot and <S>refuses to start</S> if the chain
              id or the protocol&rsquo;s chain mapping is wrong, so a misconfiguration surfaces
              immediately rather than as a confusing revert twenty minutes later.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Worker boot',
          code: `WATCHTOWER prosecutor
  creditcoin      chainId 102031
  attestcoin      chainKey 1 -> Sepolia, chainKey 3 -> Mainnet
  prosecutor      0x…  4.2 CTC`,
        },

        { kind: 'h2', text: 'Get something prosecutable' },
        {
          kind: 'p',
          children: (
            <>
              Which pools are being sandwiched changes week to week, so do not assume — scan.{' '}
              <C>stage:sandwich</C> finds a real one, discards the ones the deployed rule cannot price,
              registers the pool, funds a bounty, and prints a link that opens the application with the
              three hashes already filled in.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `pnpm balances          # is everything funded
pnpm stage:sandwich    # a real sandwich, registered and ready to paste
pnpm verify            # build, 79 tests, typecheck - the full health check`,
        },

        { kind: 'h2', text: 'The minimum that shows something working' },
        {
          kind: 'p',
          children: (
            <>
              You can skip the demo staging entirely and run read-only. Set <C>MAINNET_RPC</C>,{' '}
              <C>SEPOLIA_RPC</C>, a CTC-funded <C>DEPLOYER_PK</C>, <C>DEMO_POOL_MAINNET</C>,{' '}
              <C>DEMO_AGGREGATOR_MAINNET</C> and <C>FEED_ANCHOR_HEIGHT</C>. Deploy to Creditcoin with a
              placeholder bridge address, set <C>SUBMIT_ENABLED=false</C>, and the dashboard renders
              live registry state with no prosecutor key at all.
            </>
          ),
        },
        {
          kind: 'cards',
          items: [
            {
              href: '/docs/environment',
              title: 'Environment',
              body: 'Every .env value, where it comes from, and how much to fund each key.',
            },
            {
              href: '/docs/scripts',
              title: 'Scripts',
              body: 'What every command is for, and which three to remember.',
            },
          ],
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'end-to-end',
      title: 'The whole flow',
      lede: 'Every path a person can take through Watchtower, from the first screen to money arriving in a wallet.',
      keywords: ['flow', 'diagram', 'user flow', 'journey', 'end to end', 'map'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              One diagram for the entire application. Every decision point a visitor meets, every
              branch out of it, and the four places a path can end: cover held, a stake earning, a
              verdict on-chain, or a revert that paid nobody.
            </>
          ),
        },
        {
          kind: 'figure',
          src: '/e2e-flow.png',
          alt: 'End-to-end flow through Watchtower: landing page, dashboard, wallet connection, the three actions — protect something, back a risk, report a violation — through the proof pipeline to an on-chain incident and settlement.',
          caption: (
            <>
              The full path from <C>/</C> to settlement. Diamonds are decisions, the framed nodes are
              routes in the application, and the three outcomes at the foot are the only ways a
              prosecution ends.
            </>
          ),
          wide: true,
        },

        { kind: 'h2', text: 'Three ways in' },
        {
          kind: 'p',
          children: (
            <>
              The dashboard asks one question — what do you want to do — and there are exactly three
              answers. Each is a different person with a different reason to be here, and each is
              covered in full under <S>Using Watchtower</S>.
            </>
          ),
        },
        {
          kind: 'table',
          head: ['You want', 'You do', 'Where'],
          rows: [
            [
              'Protection against something provable',
              'Buy cover on a subject',
              <A key="a" href="/docs/buy-cover">
                Buy cover
              </A>,
            ],
            [
              'Premium income, for taking payout risk',
              "Stake to a subject's tranche",
              <A key="a" href="/docs/underwrite">
                Underwrite
              </A>,
            ],
            [
              'A contract watched',
              'Fund its bounty pool',
              <A key="a" href="/docs/fund-a-watch">
                Fund a watch
              </A>,
            ],
            [
              'Bounties',
              'Prove incidents, relayed or self-signed',
              <A key="a" href="/docs/prosecute">
                Prosecute
              </A>,
            ],
            [
              'A bad claim overturned',
              'Prove a skipped transaction, take the bond',
              <A key="a" href="/docs/challenge">
                Challenge
              </A>,
            ],
          ],
        },

        { kind: 'h2', text: 'The wallet is optional until it is not' },
        {
          kind: 'p',
          children: (
            <>
              Everything reads without a wallet — the catalogue, the vault, every incident, the whole
              archive. Only spending needs one, and the flow reflects that: the wallet branch sits
              after the dashboard, not before it.
            </>
          ),
        },
        {
          kind: 'bullets',
          items: [
            <>
              Watchtower is an <S>EVM</S> application on Creditcoin. Connect MetaMask or Rabby — not
              Phantom.
            </>,
            <>
              On the wrong network, the application says so and offers one click that adds Creditcoin
              CC3 Testnet to the wallet and switches to it.
            </>,
            <>
              Wallets are found by <S>EIP-6963 auto-discovery</S>. There is no WalletConnect project
              id and no connector package — see <A href="/docs/decisions">Decisions</A> for why.
            </>,
          ],
        },

        { kind: 'h2', text: 'The prosecution path' },
        {
          kind: 'p',
          children: (
            <>
              The right-hand branch of the diagram is the one worth tracing carefully, because it is
              where the protocol does its work and where the eight-minute floor lives.
            </>
          ),
        },
        {
          kind: 'steps',
          items: [
            <>
              Paste transaction hashes at <A href="/prosecute">/prosecute</A>. Three from one block
              reads as a sandwich; one reads as a failed transaction.
            </>,
            <>
              Choose <S>relayed</S> — the worker pays gas and takes the bounty, no wallet needed — or{' '}
              <S>sign it myself</S>, where the worker returns ready-to-sign calldata and the bounty is
              yours.
            </>,
            <>
              The pipeline narrates itself over SSE: waiting for attestation, building Merkle and
              continuity proofs, pre-flighting read-only, submitting. Attestation is{' '}
              <S>about eight minutes end to end</S>, and silence would read as a hang.
            </>,
            <>
              Creditcoin re-checks the proof inside the settling transaction. Invalid evidence reverts
              and nothing is paid — the worker cannot forge a verdict.
            </>,
            <>
              A valid window produces an <A href="/docs/verdicts">incident</A>. Instant rules settle in
              the same transaction; stream rules open a bonded claim with a challenge window.
            </>,
          ],
        },

        { kind: 'h2', text: 'The three endings' },
        {
          kind: 'terms',
          items: [
            {
              term: 'Settles instantly',
              body: (
                <>
                  A sandwich or a failed transaction. The evidence is self-contained — the three proofs{' '}
                  <S>are</S> the claim — so the vault pays cover holders in the same transaction that
                  proved it.
                </>
              ),
            },
            {
              term: 'Settle breach',
              body: (
                <>
                  A solvency claim whose challenge window closed unchallenged. Anyone can settle it,
                  the bond comes back to the prosecutor, and the payout goes through.
                </>
              ),
            },
            {
              term: 'Rolled back',
              body: (
                <>
                  Someone showed a transaction the claim skipped. The accumulator rolls back to its
                  snapshot and the challenger takes the prosecutor&rsquo;s bond. No claim was ever
                  filed by a human in any of the three.
                </>
              ),
            },
          ],
        },
      ],
    },
  ],
};
