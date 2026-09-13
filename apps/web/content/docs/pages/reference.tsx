import type { DocSection } from '../schema';
import { A, C, S } from '@/components/docs/DocBody';

export const reference: DocSection = {
  title: 'Reference',
  pages: [
    /* ==================================================================== */
    {
      slug: 'addresses',
      title: 'Addresses & networks',
      lede: 'Everything deployed, and the links that let you stop taking our word for any of it.',
      keywords: ['addresses', 'deployed', 'explorer', 'chain id', 'blockscout', 'precompile', 'live'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              Deployed on Creditcoin CC3 Testnet, reading Ethereum Mainnet and Sepolia. Every address
              below is a link into an explorer.
            </>
          ),
        },

        { kind: 'h2', text: 'Networks' },
        {
          kind: 'table',
          head: ['Network', 'Id / key', 'Role'],
          rows: [
            ['Creditcoin CC3 Testnet', <C key="a">102031</C>, 'Settlement. Every verdict lives here.'],
            ['Ethereum Mainnet', <>chainKey <C>3</C></>, 'Source. Real pools, real sandwiches, Chainlink aggregators.'],
            ['Ethereum Sepolia', <>chainKey <C>1</C></>, 'Source. DemoBridge — the staged custodian.'],
          ],
        },

        { kind: 'h2', text: 'Protocol' },
        {
          kind: 'table',
          head: ['Surface', 'Address'],
          rows: [
            ['Block Prover Precompile', <C key="a">0x0000…0FD2</C>],
            ['ChainInfo Precompile', <C key="a">0x0000…0FD3</C>],
            [
              'Proof Builder',
              <C key="a">https://prover.cc3-testnet.creditcoin.network</C>,
            ],
            ['Batch ceiling', '10 transactions, 1,000 blocks'],
          ],
        },
        {
          kind: 'note',
          tone: 'neutral',
          title: 'extcodesize is zero, and that is expected',
          children: (
            <>
              The precompiles are native Rust in the runtime, not EVM bytecode. A code-length check
              reports them missing on the chain that has them — use{' '}
              <C>NativeQueryVerifierLib.hasPrecompile()</C>.
            </>
          ),
        },

        { kind: 'h2', text: 'Watchtower' },
        {
          kind: 'table',
          head: ['Contract', 'Address'],
          rows: [
            [
              <C key="a">WatchtowerCore</C>,
              <A
                key="b"
                href="https://creditcoin-testnet.blockscout.com/address/0x886498645c18a787f6283c25012771d77b068DF2"
              >
                0x8864…8DF2
              </A>,
            ],
            [
              <C key="a">SubjectRegistry</C>,
              <A
                key="b"
                href="https://creditcoin-testnet.blockscout.com/address/0x063f5167Fe6F65c5B8c9F81862fE92678f248178"
              >
                0x063f…8178
              </A>,
            ],
            [
              <C key="a">UnderwritingVault</C>,
              <A
                key="b"
                href="https://creditcoin-testnet.blockscout.com/address/0x5c9F0cF5D0057556B1A12D8f4028253c1f1C5A14"
              >
                0x5c9F…5A14
              </A>,
            ],
            [
              <>
                <C>DemoBridge</C> (Sepolia)
              </>,
              <A key="b" href="https://sepolia.etherscan.io/address/0x4044D34f8DF534B364B5EA337b72DD508198A5eF">
                0x4044…A5eF
              </A>,
            ],
          ],
        },

        { kind: 'h2', text: 'A real mainnet sandwich, prosecuted' },
        {
          kind: 'p',
          children: (
            <>
              <A href="https://creditcoin-testnet.blockscout.com/tx/0x9cad4c89ea95410e08896de3ae35d96a978348a9cc1a082824377f5505d29308">
                0x9cad…9308
              </A>{' '}
              — block 25,955,190 of Ethereum Mainnet, transaction indices 29, 30 and 31 on the UniV2
              DAI/WETH pool.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              A searcher bracketed a stranger&rsquo;s swap and took 0.001467 WETH out of their
              execution price. Watchtower proved all three positions through the Block Prover
              Precompile in one batch call, priced the damage at <S>$3.77</S> using the ETH/USD answer
              Chainlink itself published, and paid the prosecutor 0.05 CTC for the proof. The whole
              prosecution cost 1,233,005 gas — <S>1.64 % of one Creditcoin block</S>.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              Restitution was zero, and that is the system working: the victim is a real stranger who
              never bought cover. The verdict stands on its own.
            </>
          ),
        },

        { kind: 'h2', text: 'Live deployments' },
        {
          kind: 'cards',
          items: [
            {
              href: 'https://watchtower-attestation.vercel.app',
              title: 'Dashboard',
              body: 'The application, on Vercel.',
              external: true,
            },
            {
              href: 'https://watchtower-prosecutor.onrender.com/api/health',
              title: 'Worker health',
              body: 'The prosecutor, on Render. Expect a 30–60s cold start.',
              external: true,
            },
          ],
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'decisions',
      title: 'Decisions & deviations',
      lede: 'Eight places the build differs from the plan, each with the reason recorded rather than left to be discovered.',
      keywords: ['deviations', 'decisions', 'plan', 'postgres', 'rainbowkit', 'tailwind', 'shadcn', 'mergeProofs'],
      blocks: [
        { kind: 'h2', text: 'Worker persistence is a JSON file, not Postgres' },
        {
          kind: 'p',
          children: (
            <>
              <S>Planned:</S> Postgres 16 with Drizzle. <S>Built:</S> an atomically-replaced JSON store
              behind the same interface, with <C>src/db/schema.sql</C> carrying the identical shape for
              Postgres.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              The requirement was that the worker survives a restart and replays in-flight candidates,
              which the file store does — write to temp, then rename, so a crash mid-write cannot
              corrupt it. What Postgres adds is <em>shared</em> state across several workers, which no
              part of this needs. Against that, a hard database dependency means the project cannot be
              cloned and run, and a demo that needs infrastructure to boot is a demo that can fail on
              stage. Swapping drivers later touches no caller.
            </>
          ),
        },

        { kind: 'h2', text: 'No wagmi/connectors import' },
        {
          kind: 'p',
          children: (
            <>
              <S>Planned:</S> RainbowKit with an injected connector. <S>Built:</S> wagmi&rsquo;s
              EIP-6963 auto-discovery, no connector package.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              <C>wagmi/connectors</C> pulls in <C>@base-org/account</C> → <C>@coinbase/cdp-sdk</C> →{' '}
              <C>@x402/evm</C>, which is not published, and the Next.js build fails outright.
              Auto-discovery finds injected wallets without the barrel import. The dashboard is
              read-first anyway.
            </>
          ),
        },

        { kind: 'h2', text: 'Rules read prices through IAttestedFeed' },
        {
          kind: 'p',
          children: (
            <>
              <S>Planned:</S> rules receive the subject&rsquo;s own accumulator price.{' '}
              <S>Built:</S> subjects carry a <C>priceSubject</C> pointer and rules resolve the dollar
              price through the core&rsquo;s <C>IAttestedFeed</C> interface.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              It surfaced immediately in testing: the price lives on the <em>feed</em> subject, and the
              pool and the custodian are different subjects with their own accumulators — so a sandwich
              verdict on the pool had no dollar figure to use. It also means the rules consume the same
              read interface Watchtower exposes to any other Creditcoin contract, which is a better
              answer than passing a number around.
            </>
          ),
        },

        { kind: 'h2', text: 'Creditcoin deployment runs on ethers, not forge script' },
        {
          kind: 'p',
          children: (
            <>
              Creditcoin&rsquo;s RPC omits <C>mixHash</C> from block headers, so alloy cannot
              deserialise a block and <C>forge script</C> fails — and the dangerous part is{' '}
              <S>how</S>: it broadcasts transactions it can then no longer track. The first attempt
              left three receipts out of nineteen transactions and a half-deployed system. ethers needs
              only <C>eth_sendRawTransaction</C> and <C>eth_getTransactionReceipt</C>, both served
              correctly. The rewrite also made both steps idempotent, which <C>forge script</C> never
              was.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              The same header quirk is why <C>foundry.toml</C> pins <C>evm_version = london</C>:
              post-merge specs demand <C>prevrandao</C>, which this chain&rsquo;s headers do not carry.
            </>
          ),
        },

        { kind: 'h2', text: 'proofProvider.mergeProofs is not used' },
        {
          kind: 'p',
          children: (
            <>
              Merging pays off when several chunks are combined into <em>one</em> submission. They
              cannot be: the protocol&rsquo;s batch ceiling is ten transactions, which is also the
              ceiling on one window, so a catch-up of thirty transactions is three submissions
              regardless. Each already carries exactly one continuity proof — the cheapest shape the
              protocol offers — and merging them would produce a proof no call could use. The helper is
              real and correct; this system has no call site for it.
            </>
          ),
        },

        { kind: 'h2', text: 'FailedTx reads transaction types 0, 1 and 2 only' },
        {
          kind: 'p',
          children: (
            <>
              <C>EvmV1Decoder</C> ships helpers for types 0 and 2 only. Type 1 is a three-chunk
              transaction with a documented <C>Type1Fields</C> layout, so it is read directly from its
              chunk — refusing an ordinary access-list transaction would be a bug, not a policy. Types
              3 and 4 carry a fourth chunk whose split the decoder does not expose; guessing at it would
              reimburse from the wrong field, so they are refused by name with{' '}
              <C>UnsupportedTxType(txType)</C> instead.
            </>
          ),
        },

        { kind: 'h2', text: 'Tailwind v4, not shadcn/ui' },
        {
          kind: 'p',
          children: (
            <>
              shadcn&rsquo;s defaults — rounded corners, soft shadows, muted greys — are the opposite of
              the look this product needs, so every component would have been fought rather than used.
              The primitives Watchtower actually repeats are few enough to own outright, and owning
              them is what keeps colour semantic: <C>proven</C> is sage everywhere because one file says
              so.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              The motion that matters is the block strip&rsquo;s staggered reveal, which is a CSS
              keyframe and an interval — a 40 kB animation library for that would be a poor trade in a
              bundle already carrying viem and wagmi. See{' '}
              <A href="/docs/design-system">Design system</A>.
            </>
          ),
        },

        { kind: 'h2', text: '/ is a landing page; the application starts at /dashboard' },
        {
          kind: 'p',
          children: (
            <>
              Watchtower is not a familiar product category. Dropping a first-time reader straight into
              a tool with five tabs assumes an understanding of the thesis they have no way to have
              yet, and the thesis is the interesting part. The landing page makes the argument in five
              moves and hands over one door — and it carries two numbers read live off Creditcoin, so
              the argument is checkable before a single feature is described.
            </>
          ),
        },

        { kind: 'h2', text: 'Additions the plan did not specify' },
        {
          kind: 'terms',
          items: [
            {
              term: 'Premiums are claimable',
              body: (
                <>
                  The planned vault tracked <C>premiumsEarned</C> but had no path to collect it, which
                  makes &ldquo;stake and earn premiums&rdquo; a claim the contract could not honour.
                  Premiums now accrue per unit of stake, are paid by <C>claimPremiums</C>, and are
                  carried automatically on <C>unstake</C>.
                </>
              ),
            },
            {
              term: 'Open breaches are counted',
              body: 'A stream can break twice before anyone settles the first claim; a boolean would have thawed the tranche after the first payout while the second was still in dispute.',
            },
            {
              term: 'Scanners hold no cursor',
              body: (
                <>
                  Each tick reads the proven cursor from Creditcoin and works forward. There is no local
                  cursor left to get ahead of the chain; <C>lastScanned</C> survives only as a
                  nothing-here watermark.
                </>
              ),
            },
            {
              term: 'The web app reads the repo-root .env',
              body: (
                <>
                  Next only loads <C>.env</C> from the app directory, so the bundle shipped with no
                  contract addresses. <C>next.config.mjs</C> forwards the root file&rsquo;s{' '}
                  <C>NEXT_PUBLIC_*</C> keys through Next&rsquo;s <C>env</C> option — an allowlist by
                  prefix, because the same file holds three private keys.
                </>
              ),
            },
            {
              term: 'fixtures/ is replayed by the test suite',
              body: 'The Day-1 thesis, committed as a passing assertion rather than left in a script’s output.',
            },
          ],
        },

        { kind: 'h2', text: 'What the plan got right' },
        {
          kind: 'bullets',
          items: [
            <>
              <S>Batch verification is exposed to Solidity.</S> One call per window, one shared
              continuity proof.
            </>,
            <>
              <S>
                <C>calculateTxIndex</C> is a precompile function.
              </S>{' '}
              No sibling-path arithmetic was written — and the live precompile derives indices with
              exactly the convention <C>MockBlockProver</C> implements, verified for indices 0…4095.
            </>,
            <>
              <S>
                <C>EvmV1Decoder</C> is internal-only.
              </S>{' '}
              It inlines, so there is no library linking and the deployed decoder address is
              irrelevant.
            </>,
            <>
              <S>
                <C>via_ir = true</C> is mandatory.
              </S>{' '}
              Omitting it fails with &ldquo;stack too deep&rdquo;.
            </>,
            <>
              <S>The rule-scoped replay guard was necessary</S>, exactly as predicted.
            </>,
            <>
              <S>Argument evaluation consumes a Foundry prank.</S> <C>makeAddr</C> is a cheatcode call,
              so building evidence inline in a <C>vm.prank(...)</C> call sent transactions from the
              test contract. Every test now builds its input first, then pranks.
            </>,
          ],
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'design-system',
      title: 'Design system',
      lede: 'A forensic print dossier, not a crypto dashboard. One file holds all of it.',
      keywords: ['design', 'css', 'tailwind', 'tokens', 'colour', 'typography', 'paper', 'ink', 'sage'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              <C>app/globals.css</C> is the whole design system: Tailwind v4 with an <C>@theme</C>{' '}
              block of semantic tokens and no <C>tailwind.config.js</C>. These pages are set in it too —
              the documentation is an extension of the application, not a second product.
            </>
          ),
        },

        { kind: 'h2', text: 'Ground' },
        {
          kind: 'figures',
          items: [
            { label: 'Paper — the page', value: '#f2f1ec' },
            { label: 'Card — a raised surface', value: '#fbfaf6' },
            { label: 'Ink — type and rules', value: '#101010' },
          ],
        },
        {
          kind: 'p',
          children: (
            <>
              The application is a forensic document, so it is set on warm paper rather than on the
              near-black every other chain explorer uses. Depth is a 1px rule and a three-step paper
              scale — recessed, page, raised. <S>No shadows and no gradients on surfaces.</S>
            </>
          ),
        },

        { kind: 'h2', text: 'Colour is semantic, never decorative' },
        {
          kind: 'figures',
          items: [
            { label: 'Proven', value: '#7d8f6a', sub: 'verified by the precompile', tone: 'proven' },
            { label: 'Breach', value: '#c62c17', sub: 'a violation, a victim, a shortfall', tone: 'breach' },
            { label: 'Open', value: '#9a6205', sub: 'bonded, challengeable', tone: 'pending' },
            { label: 'Settled', value: '#0f7346', sub: 'paid, solvent, resolved', tone: 'settled' },
          ],
        },
        {
          kind: 'p',
          children: (
            <>
              If a colour appears, it is asserting something about the state of a claim.{' '}
              <S>Nothing speculative is ever sage</S>, which is what keeps the accent meaning something
              by the time it lands on a verdict. The highlighter is spent{' '}
              <S>twice on the entire site</S> — the claim in the headline and the coordinate the system
              turns on.
            </>
          ),
        },
        {
          kind: 'bullets',
          items: [
            <>
              <S>The victim cell is ink, not red.</S> In a sandwich strip the victim is the subject of
              the claim, not a failure, and a second warm colour beside the accent reads as a clash.
            </>,
            <>
              <S>Tone lives in a label, a rule and type — never in a filled panel.</S> A filled tint
              block is the single most dated thing a paper interface can do; a thick coloured bar down
              one side is the second.
            </>,
            <>
              <S>Disabled is a flat grey control</S>, never a faded accent. A washed-out accent button
              reads as broken rendering rather than as &ldquo;not yet&rdquo;.
            </>,
          ],
        },

        { kind: 'h2', text: 'One grotesque, two jobs' },
        {
          kind: 'p',
          children: (
            <>
              Archivo carries every size, separated by weight and scale rather than by a second family.
              JetBrains Mono carries <S>anything the chain produced</S> — every coordinate, hash,
              amount and label. That single rule is what makes proven data look different from copy we
              wrote, and it is why the tables on these pages set contract names in mono and prose in
              sans.
            </>
          ),
        },

        { kind: 'h2', text: 'One thing moves' },
        {
          kind: 'statement',
          children: (
            <>
              Evidence arriving, once. A live system proves it is live by changing its numbers, not by
              twitching at the reader.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              There is no pulse, no blink and no breathing status dot anywhere in this system. The
              hero&rsquo;s orbit rings are the single exception and turn slowly enough to read as
              drawing rather than as motion. <C>prefers-reduced-motion</C> turns all of it off,
              including the evidence animation — the coordinates still land, they just do not travel.
            </>
          ),
        },

        { kind: 'h2', text: 'The primitive vocabulary' },
        {
          kind: 'p',
          children: (
            <>
              <C>components/ui/index.tsx</C> holds <C>Panel</C>, <C>Section</C>, <C>Stat</C>,{' '}
              <C>Badge</C>, <C>Row</C>, <C>Button</C>, <C>Field</C>, <C>Notice</C>, <C>Empty</C>,{' '}
              <C>PageHead</C>, <C>SectionHead</C>, <C>ArrowLink</C> and the bento cards. Every screen is
              built from these, so a panel on the vault page and a panel on an incident page are the
              same object.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              The <C>shell</C> utility sets one horizontal measure for every route, so the left edge of
              a heading never moves as you navigate. That is most of what makes a multi-tool
              application feel like one document.
            </>
          ),
        },

        { kind: 'h2', text: 'Cards are bento, not a row of boxes' },
        {
          kind: 'p',
          children: (
            <>
              Four moves carry it: unequal spans on a twelve-column grid so the layout states a
              hierarchy, one inverted ink cell per group for rhythm, content anchored to the bottom so
              the empty top half does the breathing, and an oversized glyph at an opacity that keeps it
              texture. <S>One graphic per card</S> — a ring behind a numeral was two decorations
              competing.
            </>
          ),
        },
        {
          kind: 'note',
          tone: 'neutral',
          title: 'Deliberately not borrowed',
          children: (
            <>
              The soft gradient washes from the reference sheets. A blurred colour bloom behind a card
              belongs to a different, softer design language than hairline rules and one flat accent,
              and mixing the two reads as indecision rather than as range.
            </>
          ),
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'limits',
      title: 'Limits',
      lede: 'What Watchtower is honest about. Every one of these is stated here rather than left to be discovered.',
      keywords: ['limits', 'honest', 'known issues', 'caveats', 'negative', 'writability', 'damages'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              A protocol that pays out on proof has to be exact about what it has <em>not</em> proven.
              This page is the list.
            </>
          ),
        },

        { kind: 'h2', text: 'You cannot prove a negative on-chain' },
        {
          kind: 'p',
          children: (
            <>
              Sandwich claims are self-contained and settle instantly. Solvency claims depend on stream
              completeness, so they are bonded, challengeable and economically secured rather than
              self-evident. <S>The asymmetry is a design feature</S>, stated rather than hidden — see{' '}
              <A href="/docs/challenges">Challenges</A>.
            </>
          ),
        },

        { kind: 'h2', text: 'Attestation takes about eight minutes' },
        {
          kind: 'p',
          children: (
            <>
              End to end, not the ~2-minute attestation cadence. The interface narrates the wait rather
              than hiding it, and a demo stages evidence ahead of time.
            </>
          ),
        },

        { kind: 'h2', text: 'No state proofs exist' },
        {
          kind: 'p',
          children: (
            <>
              The protocol proves transactions and receipts, not account state. Every balance in this
              system is therefore <S>replayed</S> from a proven event stream against an anchor, which
              is exactly why a stream can have a gap and why gaps are challengeable.
            </>
          ),
        },

        { kind: 'h2', text: 'Damages are a documented model' },
        {
          kind: 'p',
          children: (
            <>
              The sandwich figure is the attacker&rsquo;s round-trip gain on the same pool in the same
              block — a <S>lower bound</S>, since it ignores the fee they paid. The verdict is proven;
              the pricing is policy. EIP-1559 gas reimbursement uses <C>maxFeePerGas</C>, an upper
              bound, because the encoding does not carry the effective price. Capped by the policy
              either way.
            </>
          ),
        },

        { kind: 'h2', text: 'The sandwich rule prices one side of a pair' },
        {
          kind: 'p',
          children: (
            <>
              The deployed instance is configured for the 18-decimal side. A sandwich funded with the
              other side is <S>declined rather than mispriced</S>. Covering that direction means a
              second instance with the opposite configuration.
            </>
          ),
        },

        { kind: 'h2', text: 'Solvency payouts go to the first cover buyer' },
        {
          kind: 'p',
          children: (
            <>
              <C>primaryHolder</C> is first-come-first-served and <C>ReserveConservation</C> returns no
              explicit beneficiary, so a second buyer on the same custodian would not be paid from a
              breach. Sandwich and failed-transaction verdicts name their beneficiary directly and are
              unaffected. <S>Pro-rata settlement across policies is the fix.</S>
            </>
          ),
        },

        { kind: 'h2', text: 'Other vault limits' },
        {
          kind: 'bullets',
          items: [
            <>
              <S>Unstaking has no cooldown</S> beyond the frozen check — an underwriter can exit right
              up until a breach is proven.
            </>,
            <>
              <S>Cover is per subject, not per position size.</S> A $2 policy pays at most $2,
              regardless of how much you were actually trading.
            </>,
          ],
        },

        { kind: 'h2', text: 'Transaction types 3 and 4 are refused' },
        {
          kind: 'p',
          children: (
            <>
              Blob and delegation transactions carry a fourth chunk whose split the protocol&rsquo;s
              decoder does not expose. <C>FailedTx</C> reverts with <C>UnsupportedTxType(txType)</C>{' '}
              rather than reimbursing from a field it guessed at.
            </>
          ),
        },

        { kind: 'h2', text: 'Ethereum only, today' },
        {
          kind: 'p',
          children: (
            <>
              Every source chain the protocol adds becomes a new subject namespace for free — nothing
              in the engine is Ethereum-specific beyond the decoder and the rules.
            </>
          ),
        },

        { kind: 'h2', text: 'Writability is in audit' },
        {
          kind: 'p',
          children: (
            <>
              Architected for, not demoed on. Until it ships, restitution is paid on Creditcoin rather
              than enforced at the source. See <A href="/docs/attestcoin">Attestcoin Protocol</A>.
            </>
          ),
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'troubleshooting',
      title: 'Troubleshooting',
      lede: 'The failures that actually happen, what each one looks like, and the fix.',
      keywords: ['error', 'fix', 'broken', 'stale', 'mixHash', 'EROFS', 'localhost', 'revert', 'empty', 'debug'],
      blocks: [
        { kind: 'h2', text: 'The dashboard says no deployment configured' },
        {
          kind: 'p',
          children: (
            <>
              The browser bundle has no contract addresses. Next inlines <C>NEXT_PUBLIC_*</C> at build
              time, so setting one in a running dev server changes nothing —{' '}
              <S>restart <C>pnpm web</C></S>. On a hosted build, set the variables and rebuild.
            </>
          ),
        },

        { kind: 'h2', text: 'The deployed site is calling localhost:8080' },
        {
          kind: 'p',
          children: (
            <>
              <C>NEXT_PUBLIC_WORKER_API_URL</C> was set <em>after</em> the build. Rebuild, then verify
              the value actually landed in the bundle rather than trusting the setting.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `curl -s https://<site>/dashboard | grep -oP '/_next/static/chunks/[A-Za-z0-9._-]+\\.js' | sort -u \\
  | while read c; do curl -s "https://<site>$c" | grep -l localhost:8080 >/dev/null && echo "STALE: $c"; done`,
        },

        { kind: 'h2', text: 'SSE never connects on the deployed site' },
        {
          kind: 'p',
          children: (
            <>
              An https dashboard blocks a plain-http worker as mixed content, <S>silently</S>. Use the{' '}
              <C>https://</C> URL. If it is already https, check the stream holds open directly:
            </>
          ),
        },
        { kind: 'code', caption: 'Shell', code: `curl -N https://<worker>/api/stream    # ': ping' every 20s` },

        { kind: 'h2', text: 'forge script leaves a half-deployed system' },
        {
          kind: 'p',
          children: (
            <>
              Expected on Creditcoin — the RPC omits <C>mixHash</C>, so alloy cannot deserialise a
              block and <C>forge script</C> broadcasts transactions it can no longer track. Use{' '}
              <C>pnpm deploy:creditcoin</C>, which is idempotent and resumes. See{' '}
              <A href="/docs/deploy">Deploying</A>.
            </>
          ),
        },

        { kind: 'h2', text: 'stack too deep when building contracts' },
        {
          kind: 'p',
          children: (
            <>
              <C>via_ir = true</C> is missing from <C>foundry.toml</C>. It is mandatory here, not an
              optimisation.
            </>
          ),
        },

        { kind: 'h2', text: 'vm.envUint fails though .env plainly exists' },
        {
          kind: 'p',
          children: (
            <>
              Foundry loads <C>.env</C> from the <S>current directory</S>. <C>contracts/.env</C> is a
              symlink to the repo-root file — restore it if it went missing.
            </>
          ),
        },

        { kind: 'h2', text: 'The ETH/USD tile never fills' },
        {
          kind: 'p',
          children: (
            <>
              The feed subject is almost certainly pointed at the Chainlink <S>proxy</S>, which emits
              nothing. <C>AnswerUpdated</C> comes from the aggregator behind it, and that address
              changes when Chainlink upgrades the feed. Re-read it:
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `cast call 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 "aggregator()(address)" --rpc-url $MAINNET_RPC`,
        },

        { kind: 'h2', text: 'A sandwich is declined rather than judged' },
        {
          kind: 'p',
          children: (
            <>
              The searcher funded the trade with the side the deployed rule is not configured to price.
              That is the rule refusing to publish a wrong number rather than a bug — see{' '}
              <A href="/docs/limits">Limits</A>. <C>pnpm find:sandwich</C> flags these before you paste
              them in.
            </>
          ),
        },

        { kind: 'h2', text: 'A submission reverts' },
        {
          kind: 'p',
          children: (
            <>
              That is the design working: bad evidence costs gas and pays nobody. The likely causes, in
              order — a rule not bound to that subject, a wrong <C>chainKey</C>, a replayed{' '}
              <C>(rule, subject, height, index)</C>, a window that does not match the rule&rsquo;s
              shape, or a window over ten transactions. The full table is on{' '}
              <A href="/docs/submit-evidence">submitEvidence</A>.
            </>
          ),
        },

        { kind: 'h2', text: 'registerSubject reverts with SubjectExists' },
        {
          kind: 'p',
          children: (
            <>
              A subject id is <C>keccak256(chainKey, sourceContract, ruleId)</C>, so re-running a
              deployment against an existing registry cannot work. Blank the deployment block in{' '}
              <C>.env</C> and redeploy cleanly.
            </>
          ),
        },

        { kind: 'h2', text: 'EROFS: read-only file system, unlink /usr/bin/pnpm' },
        {
          kind: 'p',
          children: (
            <>
              <C>corepack enable</C> is in the host&rsquo;s build command. Render&rsquo;s Node image
              already ships pnpm and mounts <C>/usr/bin</C> read-only. Just call <C>pnpm</C>.
            </>
          ),
        },

        { kind: 'h2', text: 'No Next.js version detected' },
        {
          kind: 'p',
          children: (
            <>
              Vercel&rsquo;s Root Directory is not <C>apps/web</C>. The repo root has no <C>next</C>{' '}
              dependency, so the build has nothing to find.
            </>
          ),
        },

        { kind: 'h2', text: 'Everything looks stalled but nothing errored' },
        {
          kind: 'p',
          children: (
            <>
              Check <C>cursorLag</C>. It is the number that separates <em>nothing has happened
              lately</em> from <em>the prosecutor stopped an hour ago</em> — two states that look
              identical on a dashboard showing only the latest verdict.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `curl -s $WORKER/api/health | jq '{ok, cursorLag, queueDepth, prosecutorBalanceCtc, rpcStatus}'`,
        },
        {
          kind: 'p',
          children: (
            <>
              If the prosecutor balance is low, the header badge will already be red. Top it up —{' '}
              <C>pnpm balances</C> checks all three keys at once.
            </>
          ),
        },
      ],
    },
  ],
};
