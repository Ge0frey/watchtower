import type { DocSection } from '../schema';
import { A, C, S } from '@/components/docs/DocBody';

export const program: DocSection = {
  title: 'On-chain program',
  pages: [
    /* ==================================================================== */
    {
      slug: 'architecture',
      title: 'Architecture',
      lede: 'Four planes, one entrypoint, and three components that are deliberately not trusted.',
      keywords: ['architecture', 'planes', 'trust', 'boundary', 'asc', 'design', 'overview'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              Watchtower is four layers with one direction of travel. Evidence is found on Ethereum,
              assembled off-chain by an untrusted worker, verified and settled on Creditcoin, and read
              back by a browser that trusts the chain over the worker.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Four planes',
          code: `┌──────────────────────────────────────────────────────────────────────────────┐
│  SOURCE - Ethereum                                                           │
│  Mainnet (chainKey 3): real pools, real sandwiches, Chainlink aggregators    │
│  Sepolia (chainKey 1): DemoBridge.sol - the staged custodian                 │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │ eth_getLogs / eth_getBlock
┌───────────────▼──────────────────────────────────────────────────────────────┐
│  EVIDENCE - prosecutor worker (untrusted)                                    │
│  scanners → queue → waitUntilHeightAttested → getBatchProof → pre-flight     │
│  → submitEvidence.  Also indexes our own events for the dashboard.          │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │ eth_sendRawTransaction (chainId 102031)
┌───────────────▼──────────────────────────────────────────────────────────────┐
│  SETTLEMENT - Creditcoin CC3 Testnet                                         │
│  WatchtowerCore ── verifyAndEmit / calculateTxIndex ──► Precompile 0x0FD2    │
│                 ── evaluate (STATICCALL) ─────────────► rule library         │
│                 ── settle ────────────────────────────► UnderwritingVault    │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │ viem reads · wagmi writes · SSE narration
┌───────────────▼──────────────────────────────────────────────────────────────┐
│  PRESENTATION - one dashboard                                                │
└──────────────────────────────────────────────────────────────────────────────┘`,
        },

        { kind: 'h2', text: 'Trust boundaries' },
        {
          kind: 'terms',
          items: [
            {
              term: 'The worker',
              body: (
                <>
                  Untrusted. It assembles proofs and pays gas. It cannot forge a verdict: the
                  precompile verifies everything inside the settling transaction, so a lying worker
                  gets a revert and burns its own gas doing it.
                </>
              ),
            },
            {
              term: 'Rules',
              body: (
                <>
                  Untrusted. <C>evaluate</C> is <C>view</C>, so the core reaches it by{' '}
                  <C>STATICCALL</C>. A rule cannot write state or move money, and its worst case — a
                  wrong judgement — is bounded by the subject&rsquo;s per-block payout cap.
                </>
              ),
            },
            {
              term: 'The frontend',
              body: (
                <>
                  Untrusted. Every number that decides money is read from Creditcoin directly. The
                  worker API supplies history and enrichment only; if they disagree, the chain wins.
                </>
              ),
            },
            {
              term: "The worker's store",
              body: (
                <>
                  A cache. Delete it and the system still works — only the charts go dark. There is no
                  local cursor to get ahead of the chain, because scanners read the proven cursor from
                  Creditcoin on every tick.
                </>
              ),
            },
          ],
        },

        { kind: 'h2', text: 'Two shells, one measure' },
        {
          kind: 'code',
          caption: 'Routes',
          code: `(marketing)
/                  the landing page - the argument, then one door into the product

(app)
/dashboard         what the system has proven, is watching, and last judged
/subjects          the catalogue
/subjects/[id]     detail + buy cover + stake + fund a watch
/incidents         the archive, filterable by rule and status
/incidents/[id]    full-size block strip, evidence, verdict, challenge panel
/vault             tranches, your positions, prosecutor leaderboard
/prosecute         console - relayed or self-signed, with live pipeline narration
/docs              this documentation`,
        },
        {
          kind: 'p',
          children: (
            <>
              A first-time reader and an operator want opposite things.{' '}
              <C>app/(marketing)</C> gets a thin header and a checkable footer — someone meeting
              Watchtower for the first time should get the argument, not a toolbar of five tools they
              have no context for. <C>app/(app)</C> gets <C>AppHeader</C>, which keeps the proven head,
              the proven price and the prosecutor&rsquo;s balance in the chrome on every route.
            </>
          ),
        },

        { kind: 'h2', text: 'Deployment order' },
        {
          kind: 'p',
          children: (
            <>
              <S>Registry → Vault → Core → Rules.</S> Rules read prices through the core&rsquo;s{' '}
              <C>IAttestedFeed</C>, so they are deployed last. There is no circularity: the core
              discovers rules through the registry at call time. No library linking either —{' '}
              <C>EvmV1Decoder</C> is <C>internal</C> and inlines, so the deployed decoder address is
              irrelevant.
            </>
          ),
        },
        {
          kind: 'cards',
          items: [
            {
              href: '/docs/contracts',
              title: 'Contracts',
              body: 'What each contract is responsible for, and which one may touch the money.',
            },
            {
              href: '/docs/submit-evidence',
              title: 'submitEvidence',
              body: 'The one entrypoint, and the ten things it does in order.',
            },
          ],
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'contracts',
      title: 'Contracts',
      lede: 'Nine production contracts, four rules and two test doubles. Each with exactly one job.',
      keywords: ['contracts', 'solidity', 'core', 'registry', 'vault', 'libs', 'foundry', 'tests'],
      blocks: [
        {
          kind: 'table',
          head: ['Contract', 'Responsibility'],
          rows: [
            [
              <C key="a">WatchtowerCore</C>,
              'The ASC. The only contract that calls the precompile, and the only one that may move the vault.',
            ],
            [
              <C key="a">SubjectRegistry</C>,
              'The catalogue: which risks exist, which rules may judge them, what a mistake can cost.',
            ],
            [
              <C key="a">UnderwritingVault</C>,
              'Cover, tranches, premiums, payouts, prosecutor bounties, bonds and slashing.',
            ],
            [
              <>
                <C>IntraBlockExtraction</C> · <C>ReserveConservation</C> · <C>ChainlinkFeed</C> ·{' '}
                <C>FailedTx</C>
              </>,
              'Pure judgement. Each is a view function the core reaches by STATICCALL.',
            ],
            [
              <>
                <C>EvidenceLib</C> · <C>SubjectKey</C> · <C>SwapMath</C> · <C>PriceLib</C>
              </>,
              'Window discipline, replay keys, damages, price resolution.',
            ],
            [
              <>
                <C>DemoBridge</C> · <C>DemoToken</C>
              </>,
              'Sepolia-side staging for the demo: a custodian that can be made insolvent on purpose.',
            ],
            [
              <>
                <C>MockBlockProver</C> · <C>MaliciousRule</C>
              </>,
              'Test doubles.',
            ],
          ],
        },

        { kind: 'h2', text: 'Storage discipline' },
        {
          kind: 'p',
          children: (
            <>
              Horizontal evidence is verified, judged and discarded in one transaction — one verdict
              record remains. Stream rules persist only aggregates: <C>locked</C>, <C>minted</C>,{' '}
              <C>price</C> and the cursor. <S>Constant size</S>, no matter how much history has been
              ingested.
            </>
          ),
        },

        { kind: 'h2', text: 'The test suite' },
        {
          kind: 'p',
          children: (
            <>
              79 tests, no network needed, plus fuzzed invariants in{' '}
              <C>contracts/test/unit/Invariants.t.sol</C>. Four are worth knowing by name because each
              one holds up a claim made elsewhere in this documentation.
            </>
          ),
        },
        {
          kind: 'terms',
          items: [
            {
              term: 'test_maliciousRuleCannotMutateStateOrDrainVault',
              body: 'A hostile rule matching the selectors but declaring evaluate state-mutating. The call reverts.',
            },
            {
              term: 'test_sameTransactionServesStreamAndChallenge',
              body: 'Fails outright with a global replay guard. This is why the guard is rule-scoped.',
            },
            {
              term: 'test_declinesSandwichOnTheUnpricedSide',
              body: 'The sandwich rule refuses to price the side it was not configured for, rather than publishing a wrong figure.',
            },
            {
              term: 'FixtureReplay.t.sol',
              body: (
                <>
                  Replays a <S>real</S> captured proof bundle offline and asserts that the index
                  derived from the real Merkle sibling path equals the one the Proof Builder reported.
                  Skips loudly when no fixture is present, so a fresh clone with no API keys still runs
                  green.
                </>
              ),
            },
          ],
        },

        { kind: 'h2', text: 'Foundry configuration worth knowing' },
        {
          kind: 'bullets',
          items: [
            <>
              <C>via_ir = true</C> is <S>mandatory</S>. Omitting it fails with &ldquo;stack too
              deep&rdquo;.
            </>,
            <>
              <C>evm_version = &quot;london&quot;</C> is pinned, because post-merge specs demand{' '}
              <C>prevrandao</C> and Creditcoin&rsquo;s headers do not carry it.
            </>,
            <>
              <C>contracts/.env</C> is a symlink to the repo-root <C>.env</C>. Foundry loads{' '}
              <C>.env</C> from the <S>current directory</S>, so without it <C>vm.envUint</C> fails even
              though the file plainly exists one level up.
            </>,
          ],
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'submit-evidence',
      title: 'submitEvidence',
      lede: 'One entrypoint. A sandwich, a reserve step, a price update, a gas claim and a fraud proof are all this call.',
      keywords: ['submitEvidence', 'entrypoint', 'EvidenceInput', 'incidentId', 'revert', 'preview'],
      blocks: [
        {
          kind: 'code',
          caption: 'contracts/src/core/WatchtowerCore.sol',
          code: `function submitEvidence(EvidenceInput calldata input)
    external
    payable
    returns (bytes32 incidentId);`,
        },
        {
          kind: 'statement',
          children: (
            <>
              A sandwich prosecution, a reserve ingestion, a price update, a gas-refund claim and a
              fraud proof are all this one call with different rule ids.
            </>
          ),
        },

        { kind: 'h2', text: 'What it does, in order' },
        {
          kind: 'steps',
          items: [
            'Load the subject and rule; reject a rule not bound to the subject, a paused subject, a wrong chainKey.',
            'Verify the window — the batch overload when it has more than one transaction.',
            <>
              Derive each <C>txIndex</C> from <C>calculateTxIndex</C>.
            </>,
            <>
              Decode <C>from</C> / <C>to</C> / receipt status with <C>EvmV1Decoder</C>.
            </>,
            <>
              Sort by <C>(blockHeight, txIndex)</C> and apply the rule-scoped replay guard.
            </>,
            "Enforce the rule's declared window shape.",
            <>
              <C>rule.evaluate(...)</C> — <C>STATICCALL</C>.
            </>,
            'Apply the accumulator delta.',
            'Settle instantly, or open a bonded claim with a challenge window.',
            <>
              Emit <C>EvidenceAccepted</C> and <C>VerdictIssued</C> / <C>BreachOpened</C>.
            </>,
          ],
        },

        { kind: 'h2', text: 'Why the order matters' },
        {
          kind: 'bullets',
          items: [
            <>
              Indices are derived <S>after</S> verification and <S>before</S> sorting, so the ordering
              the contract enforces is the protocol&rsquo;s ordering and not the submitter&rsquo;s
              claim about it.
            </>,
            <>
              The replay guard runs <S>before</S> the shape check, so a duplicate is rejected cheaply
              rather than after a rule has been consulted.
            </>,
            <>
              <C>evaluate</C> is the <S>last</S> thing that happens before money moves, and it is the
              only step the core does not control — which is exactly why it is a{' '}
              <C>STATICCALL</C> against a <C>view</C> function.
            </>,
          ],
        },

        { kind: 'h2', text: 'Preview, with no gas' },
        {
          kind: 'p',
          children: (
            <>
              <C>previewEvidence()</C> runs the same path against the precompile&rsquo;s read-only{' '}
              <C>verify</C> overloads, so the dashboard can show you a verdict before anybody spends
              anything. The worker uses the same surface as its pre-flight — see{' '}
              <C>packages/attestcoin/src/preflight.ts</C>.
            </>
          ),
        },

        { kind: 'h2', text: 'What makes it revert' },
        {
          kind: 'table',
          head: ['Revert', 'Means'],
          rows: [
            ['A rule not bound to this subject', 'evidence filed under the wrong rule'],
            ['A paused subject', 'the subject was retired; existing verdicts still stand'],
            ['Wrong chainKey', 'evidence from a chain this subject does not watch'],
            [
              <C key="a">UnsupportedTxType(txType)</C>,
              'a blob (3) or delegation (4) transaction reached FailedTx',
            ],
            ['Window too large', 'more than 10 transactions, or spanning more than 1,000 blocks'],
            ['Replay', 'this exact (rule, subject, chainKey, height, index) was already used'],
            ['Shape violation', "the window is not what the rule's shape declared"],
            ['Proof failure', 'the precompile refused — the evidence was not real'],
          ],
        },
        {
          kind: 'note',
          tone: 'proven',
          title: 'A revert is the system working',
          children: (
            <>
              Every one of these happens <S>inside the settling transaction</S>, which is what makes
              the worker safe to leave untrusted. Bad evidence costs the submitter gas and pays nobody.
            </>
          ),
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'attestcoin',
      title: 'Attestcoin Protocol',
      lede: 'Every surface Watchtower uses, the round trip in full, and the four design decisions the protocol forced.',
      keywords: [
        'attestcoin',
        'precompile',
        '0x0FD2',
        'calculateTxIndex',
        'proof builder',
        'continuity',
        'chainKey',
        'EvmV1Decoder',
        'writability',
      ],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              Creditcoin CC3 Testnet, chain id <S>102031</S> (<C>0x18e8f</C>, read from the live RPC).
              Source chains Ethereum Sepolia (<C>chainKey 1</C>) and Ethereum Mainnet (
              <C>chainKey 3</C>). Mainnet being readable from a testnet deployment is what lets
              Watchtower prosecute <S>real, historical Ethereum sandwiches</S> in a testnet demo.
            </>
          ),
        },

        { kind: 'h2', text: 'Surfaces used' },
        {
          kind: 'table',
          head: ['Surface', 'Where', 'Source'],
          rows: [
            [
              <>
                Block Prover Precompile <C>0x0FD2</C> — batch <C>verifyAndEmit</C>
              </>,
              'Every submission. One call, one continuity proof shared by the whole window.',
              <C key="a">WatchtowerCore._verifyAndBuild</C>,
            ],
            [
              <>
                Precompile — single <C>verifyAndEmit</C>
              </>,
              'Single-transaction windows: FailedTx, gap challenges.',
              <C key="a">WatchtowerCore</C>,
            ],
            [
              <>
                Precompile — read-only <C>verify</C>
              </>,
              'previewEvidence() and the worker pre-flight. Costs no gas.',
              <C key="a">preflight.ts</C>,
            ],
            [
              <>
                Precompile — <C>calculateTxIndex</C>
              </>,
              "The project's thesis. Every position comes from the protocol, never from our arithmetic.",
              <C key="a">WatchtowerCore._buildWindow</C>,
            ],
            [
              <C key="a">TransactionVerified</C>,
              'Free third-party corroboration on the explorer for every verdict.',
              'emitted by the precompile',
            ],
            [
              <C key="a">EvmV1Decoder</C>,
              'Receipt status, from/to, gas used, log filtering by signature, type-specific gas price.',
              'core and all four rules',
            ],
            [
              <C key="a">NativeQueryVerifierLib</C>,
              'getVerifier(), plus hasPrecompile() and isCreditcoinChainId() as environment guards.',
              'core constructor',
            ],
            [
              <>
                ChainInfo Precompile <C>0x0FD3</C>
              </>,
              'Boot assertion on the chainKey mapping; the attested-head badge.',
              <C key="a">client.ts</C>,
            ],
            [
              'Proof Builder service',
              'waitUntilHeightAttested, getProof, getBatchProof.',
              <C key="a">proofs.ts</C>,
            ],
            [
              <C key="a">utils.gas.computeGasLimit</C>,
              'Gas limits on every submission.',
              <C key="a">gas.ts</C>,
            ],
          ],
        },
        {
          kind: 'p',
          children: (
            <>
              Everything except writability, which is still in third-party audit and is deliberately
              kept off the critical path.
            </>
          ),
        },

        { kind: 'h2', text: 'The readability round trip' },
        {
          kind: 'code',
          caption: 'End to end',
          code: `Ethereum                     Prosecutor worker                    Creditcoin
   │                                │                                  │
   │  a sandwich lands in a block   │                                  │
   ├───────────────────────────────►│  scanners/intraBlock.ts          │
   │                                │  three consecutive indices,      │
   │                                │  same sender on the outside      │
   │                                │                                  │
   │                                │  waitUntilHeightAttested ────────┤  attestors commit
   │                                │  (~8 min end to end)             │  the block
   │                                │                                  │
   │                                │  getBatchProof([t-1, t, t+1])    │
   │                                │  one shared continuity proof     │
   │                                │                                  │
   │                                │  prover.verifyBatch (read-only)  │
   │                                │  pre-flight, costs no gas        │
   │                                │                                  │
   │                                │  submitEvidence(EvidenceInput) ─►│  WatchtowerCore
   │                                │                                  │   ├ verifyAndEmit (batch)
   │                                │                                  │   ├ calculateTxIndex ×3
   │                                │                                  │   ├ decode receipts
   │                                │                                  │   ├ replay guard
   │                                │                                  │   ├ adjacency check
   │                                │                                  │   ├ rule.evaluate (STATICCALL)
   │                                │                                  │   └ vault.settle
   │                                │◄─────────────── VerdictIssued ───┤`,
        },
        {
          kind: 'p',
          children: (
            <>
              Steps one to five are the protocol&rsquo;s documented readability flow; steps six to ten
              are Watchtower&rsquo;s business logic. Nothing between them is trusted.
            </>
          ),
        },

        { kind: 'h2', text: 'What the protocol forced' },
        {
          kind: 'terms',
          items: [
            {
              term: 'No state proofs',
              body: (
                <>
                  The protocol proves transactions and receipts, not account state.{' '}
                  <C>ReserveConservation</C> therefore accumulates <C>Locked</C>/<C>Unlocked</C>/
                  <C>Minted</C>/<C>Burned</C> from an anchor, and the cursor is what makes the replay
                  ordered and inspectable.
                </>
              ),
            },
            {
              term: 'Success is not checked for you',
              body: (
                <>
                  Every path asserts <C>receiptStatus == 1</C>. <C>FailedTx</C> is the single rule that
                  asserts <C>== 0</C>, and that inversion lives in the rule, never in the core.
                </>
              ),
            },
            {
              term: 'Batch order is not guaranteed',
              body: (
                <>
                  <C>getBatchProof</C> returns nested maps, and map iteration order carries no promise.
                  The worker sorts before submitting; the contract sorts again and re-derives every
                  index from the precompile, so a dishonest ordering cannot survive.
                </>
              ),
            },
            {
              term: 'Gas estimation fails against precompiles',
              body: (
                <>
                  <C>pallet-evm</C> does not reliably propagate revert reasons in estimation mode, so
                  submissions use the SDK&rsquo;s <C>computeGasLimit</C>, which falls back to{' '}
                  <C>21000 + continuityLength × 5000 + 20000</C>. Never raw <C>estimateGas</C>.
                </>
              ),
            },
            {
              term: 'Ten transactions, 1,000 blocks',
              body: (
                <>
                  <C>_checkShape</C> rejects larger windows and the stream scanner chunks to match.
                </>
              ),
            },
            {
              term: 'Attestation is ~8 minutes',
              body: (
                <>
                  Not the ~2-minute cadence. The official example waits with{' '}
                  <C>(15_000, 1_200_000)</C> and says so; Watchtower uses the same values and narrates
                  the wait rather than hiding it behind a spinner.
                </>
              ),
            },
          ],
        },

        { kind: 'h2', text: 'Verifying the integration itself' },
        {
          kind: 'p',
          children: (
            <>
              Creditcoin&rsquo;s precompile is native Rust in the runtime, not EVM bytecode —{' '}
              <C>extcodesize</C> is zero and a forked anvil node does <S>not</S> have it. Unit tests
              therefore <C>vm.etch</C> a stateless <C>MockBlockProver</C> at <C>0x0FD2</C>. Three
              checks keep that substitution honest against the live chain rather than against
              documentation.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `pnpm verify:precompile                        # 0x0FD2 derives indices 0…4095 our way
pnpm thesis <front> <victim> <back>           # SDK, precompile and Etherscan must agree
pnpm capture <txHash>…                        # freeze a real bundle into fixtures/
forge test --match-path test/unit/FixtureReplay.t.sol   # replay it offline`,
        },
        {
          kind: 'note',
          tone: 'proven',
          title: 'Why the naive check would be wrong',
          children: (
            <>
              <C>NativeQueryVerifierLib.hasPrecompile()</C> is the correct production guard precisely
              because a code-length check would report the precompile missing on the chain that has it.
            </>
          ),
        },

        { kind: 'h2', text: 'Writability, when it ships' },
        {
          kind: 'p',
          children: (
            <>
              Watchtower is architected for it and demos without it.{' '}
              <C>@gluwa/asc-contracts@0.2.1</C> already ships the outbound suite — <C>Outbox</C>,{' '}
              <C>Inbox</C>, <C>AttestorRegistry</C>, <C>RelayerContract</C>, <C>ASCProofVerifier</C> —
              so the path is concrete: a settled verdict publishes a message to the destination
              chain&rsquo;s Outbox, attestors sign it, a relayer delivers it to the Inbox, and
              restitution is enforced <S>at the source</S> rather than reimbursed on Creditcoin.
            </>
          ),
        },
        {
          kind: 'statement',
          children: <>Readability proves the harm. Writability undoes it.</>,
        },

        { kind: 'h2', text: 'File map' },
        {
          kind: 'code',
          caption: 'Where each conversation with the protocol lives',
          code: `contracts/src/core/WatchtowerCore.sol            the ASC - the only caller of the precompile
contracts/src/libs/EvidenceLib.sol              window shapes and ordering
contracts/src/libs/SubjectKey.sol               rule-scoped replay keys
contracts/src/rules/IntraBlockExtraction.sol    sandwich rule
contracts/src/rules/ReserveConservation.sol     custodian solvency rule
contracts/src/rules/ChainlinkFeed.sol           proven price import
contracts/src/rules/FailedTx.sol                failed-transaction rule
packages/attestcoin/src/client.ts               SDK client and boot assertions
packages/attestcoin/src/proofs.ts               proof building and batch flattening
packages/attestcoin/src/preflight.ts            read-only pre-flight
packages/attestcoin/src/encode.ts               proof → calldata
packages/attestcoin/src/gas.ts                  gas limits
packages/attestcoin/src/scripts/thesis.ts       Day-1 thesis check
packages/attestcoin/src/scripts/verify-precompile.ts   precompile conformance
packages/attestcoin/src/scripts/capture-fixtures.ts    real-bundle capture
contracts/test/unit/FixtureReplay.t.sol         real-bundle replay, offline
contracts/test/unit/Invariants.t.sol            fuzzed invariants`,
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'gas',
      title: 'Gas & measured cost',
      lede: 'Not from the documentation — from our own receipts on CC3 Testnet.',
      keywords: ['gas', 'cost', 'measured', 'receipt', 'MAX_GAS_CAP', 'block', 'percentage'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              <C>MAX_GAS_CAP</C> on Creditcoin is 75,000,000, so the share below is of one whole
              Creditcoin block. Every figure came off a receipt, not out of an estimate.
            </>
          ),
        },
        {
          kind: 'table',
          head: ['Submission', 'Continuity roots', 'Gas used', 'Share of a block'],
          rows: [
            [
              <>
                <C>IntraBlockExtraction</C> — <S>three transactions</S> in one batch call, one shared
                continuity proof
              </>,
              '1',
              '1,233,005',
              '1.64 %',
            ],
            [
              <>
                <C>ChainlinkFeed</C>, one transaction
              </>,
              '4',
              '519,540',
              '0.69 %',
            ],
            [
              <>
                <C>ReserveConservation</C>, one transaction
              </>,
              '50',
              '502,390',
              '0.67 %',
            ],
          ],
        },
        {
          kind: 'statement',
          children: (
            <>
              A complete sandwich prosecution — three Ethereum transactions verified, three indices
              derived from the precompile, three receipts decoded, a rule evaluated and the vault
              moved — costs under two percent of one Creditcoin block.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              Receipt:{' '}
              <A href="https://creditcoin-testnet.blockscout.com/tx/0x9cad4c89ea95410e08896de3ae35d96a978348a9cc1a082824377f5505d29308">
                0x9cad…9308
              </A>
              .
            </>
          ),
        },

        { kind: 'h2', text: 'Reproducing it' },
        {
          kind: 'p',
          children: (
            <>
              The worker logs <C>gasAsPercentageOfMax(receipt.gasUsed)</C> for every submission, so
              this table is reproducible rather than quoted: run the worker and read the{' '}
              <C>[queue] … settled in …</C> line.
            </>
          ),
        },

        { kind: 'h2', text: 'What actually costs the gas' },
        {
          kind: 'p',
          children: (
            <>
              Continuity roots, and almost nothing else. Notice that the three-transaction sandwich —
              the most work the system ever does — used <S>fewer</S> continuity roots than the
              single-transaction reserve step, and the cost tracks the roots rather than the
              transactions. That is the whole reason{' '}
              <A href="/docs/bounties">bounty multipliers</A> are derived from continuity length: the
              protocol&rsquo;s cost curve is already the right signal, so nothing else needs to be
              invented.
            </>
          ),
        },
        {
          kind: 'note',
          tone: 'neutral',
          title: 'Deployment costs almost nothing',
          children: (
            <>
              Creditcoin gas is negligible — the whole deployment is a fraction of a CTC. The real
              spend is <C>SeedDemo</C>&rsquo;s 8.30 CTC, and that is capital you own inside the vault,
              not a fee.
            </>
          ),
        },
      ],
    },
  ],
};
