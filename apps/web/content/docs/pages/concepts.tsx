import type { DocSection } from '../schema';
import { A, C, S } from '@/components/docs/DocBody';

export const concepts: DocSection = {
  title: 'Core concepts',
  pages: [
    /* ==================================================================== */
    {
      slug: 'subjects',
      title: 'Subjects',
      lede: 'The unit everything attaches to. A pool, a bridge, a custodian, a price feed — each bound to one rule.',
      keywords: ['subject', 'registry', 'subjectId', 'kind', 'payout cap', 'priceSubject', 'catalogue'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              Everything in Watchtower is a <S>subject</S>: one contract on one source chain, bound to
              one rule that says what can be proven about it. Cover, capital and bounties all attach to
              subjects, and every incident names one.
            </>
          ),
        },
        {
          kind: 'statement',
          children: (
            <>
              A subject is a risk the system has agreed to have an opinion about, and the exact rule it
              will be judged by.
            </>
          ),
        },

        { kind: 'h2', text: 'What a subject carries' },
        {
          kind: 'terms',
          items: [
            {
              term: 'chainKey',
              body: (
                <>
                  Which source chain. <C>1</C> is Ethereum Sepolia, <C>3</C> is Ethereum Mainnet. The
                  worker asserts this mapping against the protocol at boot and refuses to start if it
                  is wrong.
                </>
              ),
            },
            {
              term: 'sourceContract',
              body: 'The address being watched — a pool, a bridge, a Chainlink aggregator, an account.',
            },
            {
              term: 'ruleId',
              body: (
                <>
                  The one rule allowed to judge it. Evidence filed under any other rule is rejected
                  before a proof is even looked at.
                </>
              ),
            },
            {
              term: 'kind',
              body: (
                <>
                  <C>Pool</C>, <C>Custodian</C>, <C>Feed</C> or <C>Account</C>. Presentation and
                  scanner routing; the rule is what actually decides anything.
                </>
              ),
            },
            {
              term: 'payoutCapPerBlock',
              body: (
                <>
                  The ceiling on what one block of evidence can cost the vault. This is the bound on a
                  wrong judgement by an untrusted rule, and it is why a hostile rule is an economic
                  problem rather than a fatal one.
                </>
              ),
            },
            {
              term: 'priceSubject',
              body: (
                <>
                  A pointer to the feed subject this one prices against. A pool and a custodian have
                  their own accumulators and no price of their own, so damages resolve through the
                  core&rsquo;s <C>IAttestedFeed</C> interface — see{' '}
                  <A href="/docs/decisions">Decisions</A>.
                </>
              ),
            },
            {
              term: 'state',
              body: (
                <>
                  The accumulator a stream rule maintains: <C>locked</C>, <C>minted</C>, <C>price</C>,
                  and the proven cursor <C>(blockHeight, txIndex)</C>. Constant size, no matter how
                  much history has been ingested.
                </>
              ),
            },
          ],
        },

        { kind: 'h2', text: 'The id is derived, not assigned' },
        {
          kind: 'code',
          caption: 'contracts/src/libs/SubjectKey.sol',
          code: `subjectId = keccak256(abi.encode(chainKey, sourceContract, ruleId))`,
        },
        {
          kind: 'p',
          children: (
            <>
              Deterministic, which means the same contract judged by the same rule is always the same
              subject and cannot be registered twice — <C>registerSubject</C> reverts with{' '}
              <C>SubjectExists</C>. It also means the same address can legitimately appear as several
              subjects under different rules: a bridge can be watched for solvency and for failed
              transactions at once, and those are two separate risks with separate capital behind them.
            </>
          ),
        },

        { kind: 'h2', text: 'The four seeded subjects' },
        {
          kind: 'table',
          head: ['Subject', 'Source', 'Rule', 'What it means'],
          rows: [
            [
              <C key="a">SUBJECT_POOL</C>,
              'A UniV2-style pair on Ethereum Mainnet',
              'IntraBlockExtraction',
              'Traders on this pool are covered against being bracketed',
            ],
            [
              <C key="a">SUBJECT_BRIDGE</C>,
              'DemoBridge on Sepolia',
              'ReserveConservation',
              'This custodian is covered against minting more than it locked',
            ],
            [
              <C key="a">SUBJECT_FEED</C>,
              'The Chainlink ETH/USD aggregator',
              'ChainlinkFeed',
              'The source of every dollar figure in the system',
            ],
            [
              <C key="a">SUBJECT_ACCOUNT</C>,
              'One Sepolia address',
              'FailedTx',
              'Gas burned on a reverted transaction is reimbursed',
            ],
          ],
        },
        {
          kind: 'note',
          tone: 'proven',
          title: 'The feed subject is not insurance',
          children: (
            <>
              <C>ChainlinkFeed</C> is a <S>source rule</S>. It never pays anyone. Its only job is to
              import the price Chainlink itself published — proven from that aggregator&rsquo;s own{' '}
              <C>AnswerUpdated</C> transaction, not reported by us — so every other rule has a dollar
              figure that came off a chain rather than out of a backend.
            </>
          ),
        },

        { kind: 'h2', text: 'Adding one' },
        {
          kind: 'p',
          children: (
            <>
              Anyone can put Watchtower on a contract. <C>pnpm watch</C> registers the subject, links
              it to the proven feed, stakes and funds the bounty in a single command, and it appears on
              the dashboard within one poll.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `pnpm watch 0xPOOL --label "UniV2 DAI/WETH" --bounty 0.25 --stake 1
pnpm retire 0xPOOL     # take it out of the dropdown again`,
        },
        {
          kind: 'p',
          children: (
            <>
              A paused subject rejects evidence rather than deleting history: every verdict already
              issued against it stands. See <A href="/docs/fund-a-watch">Fund a watch</A> for the
              in-application path.
            </>
          ),
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'rules',
      title: 'Rules',
      lede: 'Pure judgement. Four of them today, each one a view function the engine cannot let touch money.',
      keywords: [
        'rule',
        'evaluate',
        'staticcall',
        'IntraBlockExtraction',
        'ReserveConservation',
        'ChainlinkFeed',
        'FailedTx',
        'GapChallenge',
      ],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              A rule answers one question about a verified window of Ethereum transactions: did this
              happen, who was harmed, and by how much. It is a <C>view</C> function. The core reaches
              it by <C>STATICCALL</C>, so a rule <S>cannot write state and cannot move money</S>, and
              the worst thing a hostile one can do is return a wrong number — bounded by the
              subject&rsquo;s per-block payout cap.
            </>
          ),
        },
        {
          kind: 'note',
          tone: 'proven',
          title: 'Proven, not asserted',
          children: (
            <>
              <C>test_maliciousRuleCannotMutateStateOrDrainVault</C> deploys a hostile rule that
              matches the selectors but declares <C>evaluate</C> state-mutating. The call reverts. The
              guarantee is a passing test, not a paragraph.
            </>
          ),
        },

        { kind: 'h2', text: 'The four' },
        {
          kind: 'table',
          head: ['Rule', 'Window', 'Settlement', 'Beneficiary'],
          rows: [
            [<C key="a">IntraBlockExtraction</C>, '3 adjacent, one block', 'Instant', 'named by the rule'],
            [<C key="a">ReserveConservation</C>, 'ordered stream ≤ 10', 'Optimistic', "the subject's primary holder"],
            [<C key="a">ChainlinkFeed</C>, 'ordered stream ≤ 10', 'source rule', 'nobody — it imports a price'],
            [<C key="a">FailedTx</C>, '1 transaction', 'Instant', 'named by the rule'],
          ],
        },

        { kind: 'h3', text: 'IntraBlockExtraction' },
        {
          kind: 'p',
          children: (
            <>
              Three transactions at <S>consecutive indices inside one block</S>, all touching the same
              pool, with the same sender on the outside and a stranger in the middle, and the outer
              pair completing a round trip in profit. Damages are the attacker&rsquo;s round-trip gain
              on that pool in that block, priced at the ETH/USD answer the feed subject proved.
            </>
          ),
        },
        {
          kind: 'note',
          tone: 'pending',
          title: 'It declines rather than guesses',
          children: (
            <>
              The deployed instance is configured for the 18-decimal side of its pair (
              <C>tokenDecimals = 18</C>, <C>pricedSideIsToken0 = false</C>). A sandwich the searcher
              funded with the 6-decimal side is refused rather than priced twelve orders of magnitude
              wrong. Covering that direction means a second instance —{' '}
              <C>test_declinesSandwichOnTheUnpricedSide</C>.
            </>
          ),
        },

        { kind: 'h3', text: 'ReserveConservation' },
        {
          kind: 'p',
          children: (
            <>
              A running balance sheet rebuilt from a proven, gap-checked event stream:{' '}
              <C>Locked</C>, <C>Unlocked</C>, <C>Minted</C>, <C>Burned</C>, accumulated forward from an
              anchor height. When <C>minted &gt; locked</C> the shortfall is a breach. The protocol
              proves transactions and receipts but not account state, which is precisely why the
              balance is replayed rather than read — see <A href="/docs/attestcoin">Attestcoin</A>.
            </>
          ),
        },

        { kind: 'h3', text: 'ChainlinkFeed' },
        {
          kind: 'p',
          children: (
            <>
              Ingests <C>AnswerUpdated</C> from a Chainlink aggregator and stores the answer on the
              feed subject. Every other rule resolves dollars through it. Point a feed subject at the
              ETH/USD <S>proxy</S> rather than the aggregator behind it and the price tile stays empty
              forever, because the proxy emits nothing.
            </>
          ),
        },

        { kind: 'h3', text: 'FailedTx' },
        {
          kind: 'p',
          children: (
            <>
              The one rule that asserts <C>receiptStatus == 0</C>. Every other path in the system
              asserts success, and that inversion lives in the rule rather than in the core — which is
              the whole reason the core can stay rule-agnostic. It reimburses the gas burned, capped by
              the policy.
            </>
          ),
        },
        {
          kind: 'bullets',
          items: [
            <>
              Transaction types <C>0</C> (legacy), <C>1</C> (EIP-2930) and <C>2</C> (EIP-1559) are
              decoded. Types <C>3</C> (blob) and <C>4</C> (delegation) revert with{' '}
              <C>UnsupportedTxType(txType)</C> — refused by name rather than guessed at.
            </>,
            <>
              EIP-1559 reimbursement uses <C>maxFeePerGas</C>, an upper bound, because the encoding
              does not carry the effective price. Capped by the policy either way.
            </>,
          ],
        },

        { kind: 'h3', text: 'GapChallenge' },
        {
          kind: 'p',
          children: (
            <>
              Not insurance — the system&rsquo;s own defence. One transaction, filed against an open
              optimistic claim, proving the prosecutor skipped something inside the range they claimed
              to cover. It runs through the same entrypoint as every other submission. See{' '}
              <A href="/docs/challenges">Challenges</A>.
            </>
          ),
        },

        { kind: 'h2', text: 'Rule ids' },
        {
          kind: 'p',
          children: (
            <>
              A rule id is the keccak of a versioned literal, computed identically in Solidity and in{' '}
              <C>packages/shared</C>. Versioning is in the string, so replacing a rule is a new id and
              a new subject rather than a silent change of meaning under existing cover.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'packages/shared/src/rules.ts',
          code: `watchtower.rule.intra-block-extraction.v1
watchtower.rule.reserve-conservation.v1
watchtower.rule.chainlink-feed.v1
watchtower.rule.failed-tx.v1
watchtower.rule.gap-challenge.v1`,
        },

        { kind: 'h2', text: 'Writing a fifth' },
        {
          kind: 'p',
          children: (
            <>
              Declare a window shape and a settlement mode, implement <C>evaluate</C> as a pure
              function of the verified window, register a subject bound to it. The engine, the vault,
              the feed, the bounty schedule and the challenge machinery all come for free.{' '}
              <C>FailedTx.sol</C> is sixty lines and is the one to read first.
            </>
          ),
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'evidence',
      title: 'Evidence & windows',
      lede: 'What you actually submit: a proven set of Ethereum transactions, in a shape the rule declared in advance.',
      keywords: ['evidence', 'window', 'batch', 'merkle', 'continuity', 'replay guard', 'txIndex', 'shape'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              Evidence is a <S>window</S>: one or more Ethereum transactions, each with a Merkle proof,
              sharing one continuity proof, submitted together and verified in a single call to the
              precompile. The window is what makes a claim about execution order possible, because the
              claim is never about one transaction — it is about several, and their positions.
            </>
          ),
        },

        { kind: 'h2', text: 'The three shapes' },
        {
          kind: 'table',
          head: ['Shape', 'Means', 'Used by'],
          rows: [
            [
              <C key="a">SingleTx</C>,
              'Exactly one transaction. No ordering to check.',
              'FailedTx, GapChallenge',
            ],
            [
              <C key="a">IntraBlockAdjacent</C>,
              'All in one block, at strictly consecutive indices.',
              'IntraBlockExtraction',
            ],
            [
              <C key="a">SequentialStream</C>,
              'Ordered by (height, index), starting exactly at the proven cursor.',
              'ReserveConservation, ChainlinkFeed',
            ],
          ],
        },
        {
          kind: 'p',
          children: (
            <>
              The shape is declared by the rule and enforced by the core in{' '}
              <C>WatchtowerCore._checkShape</C>, before <C>evaluate</C> is ever called. A rule never
              has to defend itself against a window it did not ask for.
            </>
          ),
        },

        { kind: 'h2', text: 'Every index comes from the protocol' },
        {
          kind: 'statement',
          children: (
            <>
              No sibling-path arithmetic was written in this repository. Every transaction&rsquo;s
              position is derived by <C>calculateTxIndex</C>, inside the settling transaction.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              This is the project&rsquo;s thesis and it is also its security. A dishonest ordering
              cannot survive submission: the worker sorts, the contract sorts again, and then{' '}
              <S>re-derives every index from the precompile</S> rather than believing the one it was
              handed. <C>getBatchProof</C> returns nested maps whose iteration order carries no
              promise, so an unsorted batch is an ordinary occurrence rather than an attack — and it is
              handled the same way either case would be.
            </>
          ),
        },

        { kind: 'h2', text: 'Limits, and where they come from' },
        {
          kind: 'figures',
          items: [
            { label: 'Transactions per window', value: '10', sub: 'protocol batch ceiling' },
            { label: 'Block span per window', value: '1,000', sub: 'enforced by _checkShape' },
            { label: 'Attestation, end to end', value: '~8 min', sub: 'not the ~2 min cadence' },
          ],
        },
        {
          kind: 'p',
          children: (
            <>
              The stream scanner chunks to match the ceiling, so catching up thirty transactions is
              three submissions regardless of how they are proved. That is also why{' '}
              <C>mergeProofs</C> has no call site here — see <A href="/docs/decisions">Decisions</A>.
            </>
          ),
        },

        { kind: 'h2', text: 'The replay guard is rule-scoped' },
        {
          kind: 'p',
          children: (
            <>
              The reference ASC dedupes on <C>keccak(chainKey, height, txIndex)</C>. Watchtower cannot,
              because one Ethereum transaction is legitimately evidence under several rules at once: a
              bridge <C>Locked</C> transaction feeds the reserve accumulator, and the{' '}
              <S>same transaction</S> may later prove that the accumulator skipped it.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'contracts/src/libs/SubjectKey.sol',
          code: `key = keccak256(ruleId, subjectId, chainKey, blockHeight, txIndex)`,
        },
        {
          kind: 'note',
          tone: 'proven',
          title: 'Predicted, then confirmed',
          children: (
            <>
              <C>test_sameTransactionServesStreamAndChallenge</C> fails outright with a global guard.
              The rule-scoped key is not a refinement; without it the fraud proof cannot be filed at
              all.
            </>
          ),
        },

        { kind: 'h2', text: 'What the core checks, in order' },
        {
          kind: 'steps',
          items: [
            'Load the subject and rule. Reject a rule not bound to the subject, a paused subject, a wrong chainKey.',
            'Verify the window through the precompile — the batch overload when it has more than one transaction.',
            <>
              Derive each <C>txIndex</C> from <C>calculateTxIndex</C>.
            </>,
            <>
              Decode <C>from</C>, <C>to</C> and receipt status with <C>EvmV1Decoder</C>.
            </>,
            <>
              Sort by <C>(blockHeight, txIndex)</C> and apply the rule-scoped replay guard.
            </>,
            "Enforce the rule's declared window shape.",
            <>
              Call <C>rule.evaluate(...)</C> by <C>STATICCALL</C>.
            </>,
          ],
        },
        {
          kind: 'p',
          children: (
            <>
              Everything after that is settlement. The full listing, including what is emitted, is on{' '}
              <A href="/docs/submit-evidence">submitEvidence</A>.
            </>
          ),
        },

        { kind: 'h2', text: 'Nothing is kept that need not be' },
        {
          kind: 'p',
          children: (
            <>
              Horizontal evidence is verified, judged and <S>discarded in one transaction</S> — one
              verdict record remains. Stream rules persist only aggregates and a cursor. Storage is
              constant no matter how much Ethereum history has been ingested, which is what stops an
              insurance protocol turning into an archive nobody can afford to write to.
            </>
          ),
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'verdicts',
      title: 'Verdicts & settlement',
      lede: 'What happens after a window verifies: an incident on-chain, and money that moves in the same block or after a window.',
      keywords: ['incident', 'verdict', 'settlement', 'instant', 'optimistic', 'breach', 'payout'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              A verified window that a rule judged produces an <S>incident</S> — a record on
              Creditcoin naming the subject, the rule, the coordinates, the damages and the
              beneficiary. Everything you can see at <A href="/incidents">/incidents</A> is one of
              these, read back off the chain.
            </>
          ),
        },

        { kind: 'h2', text: 'Two settlement modes' },
        {
          kind: 'table',
          head: ['', 'Sandwich', 'Solvency'],
          rows: [
            [
              'Soundness',
              'self-contained — the three proofs are the claim',
              'depends on stream completeness',
            ],
            [
              'Settlement',
              <C key="a">INSTANT</C>,
              <>
                <C>OPTIMISTIC</C> — bonded, with a challenge window
              </>,
            ],
            [
              'Defence',
              'none needed',
              'gap challenge: prove a skipped transaction inside the claimed range',
            ],
          ],
        },
        {
          kind: 'statement',
          children: (
            <>
              You cannot prove a negative on-chain, so Watchtower does not pretend to. The asymmetry is
              a design feature, stated rather than hidden.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              A sandwich claim carries its own completeness: three adjacent indices in one block either
              are what the rule describes or they are not, and the precompile settles that question
              inside the transaction. A solvency claim depends on the prosecutor having skipped
              nothing, and no on-chain check can establish that. So those claims are{' '}
              <S>bonded and left open</S> for a window instead — economically secured rather than
              self-evident.
            </>
          ),
        },

        { kind: 'h2', text: 'What a verdict emits' },
        {
          kind: 'terms',
          items: [
            {
              term: 'EvidenceAccepted',
              body: 'The window verified and the replay guard was clean. Nothing has been judged yet.',
            },
            {
              term: 'VerdictIssued',
              body: 'A rule judged, damages were priced, and an instant settlement paid.',
            },
            {
              term: 'BreachOpened',
              body: 'An optimistic claim with a bond posted and a challenge window running.',
            },
            {
              term: 'TransactionVerified',
              body: (
                <>
                  Emitted by the precompile itself, not by Watchtower. Free third-party corroboration
                  on the explorer for every verdict — the chain saying the same thing we do, in its own
                  words.
                </>
              ),
            },
          ],
        },

        { kind: 'h2', text: 'Damages are policy; the verdict is proof' },
        {
          kind: 'p',
          children: (
            <>
              Worth being precise about, because it is the one place the system makes a judgement call.
              The sandwich figure is the attacker&rsquo;s round-trip gain on the same pool in the same
              block — a <S>lower bound</S>, since it ignores the fee they paid. It is a documented
              model, not a reconstruction of what the victim would have got in a counterfactual block.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              The dollar figure attached to it is proven: it is the ETH/USD answer Chainlink itself
              published, imported from that aggregator&rsquo;s own transaction by{' '}
              <A href="/docs/rules">ChainlinkFeed</A>. Proven, not reported.
            </>
          ),
        },

        { kind: 'h2', text: 'A verdict can pay nothing, and still be right' },
        {
          kind: 'note',
          tone: 'neutral',
          title: 'Insurance pays the insured',
          children: (
            <>
              Watchtower prosecutes real mainnet sandwiches whose victims are strangers who never
              bought cover. Those verdicts are correct, they stand on-chain, and the prosecutor is paid
              for proving them — but restitution is zero, because the victim held no policy. The
              incident page says so plainly rather than showing a payout that did not happen.
            </>
          ),
        },

        { kind: 'h2', text: 'Reading an incident' },
        {
          kind: 'p',
          children: (
            <>
              <A href="/incidents">/incidents</A> is the archive, filterable by rule and status.{' '}
              <C>/incidents/[id]</C> is the full record: a block strip, the decoded evidence, the
              verdict, and — on an open breach — the challenge panel and its countdown.
            </>
          ),
        },
        {
          kind: 'bullets',
          items: [
            <>
              An <S>intra-block</S> strip lights three adjacent cells with the untouched neighbours
              dimmed, so the shape of the claim is visible before any of the numbers are read.
            </>,
            <>
              A <S>stream</S> strip lights a run across blocks with the cursor marked, and any proven
              gap punched out of it.
            </>,
            <>
              The victim cell is <S>ink, not red</S>. In a sandwich the victim is the subject of the
              claim, not a failure. Red is reserved for things that really are wrong: a shortfall, a
              rolled-back verdict, a stale continuity proof.
            </>,
          ],
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'challenges',
      title: 'Challenges & the bond',
      lede: "Watchtower's defence against its own prosecutors, and it runs on Watchtower.",
      keywords: ['challenge', 'gap', 'bond', 'slash', 'fraud proof', 'optimistic', 'rollback', 'window'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              An optimistic claim asserts something no chain can check: that the prosecutor ingested{' '}
              <S>every</S> relevant transaction in the range they claimed. Rather than assume it,
              Watchtower prices it. The prosecutor posts a bond, the claim sits open for a challenge
              window, and anyone who can show a skipped transaction takes the bond.
            </>
          ),
        },

        { kind: 'h2', text: 'How a gap challenge works' },
        {
          kind: 'steps',
          items: [
            <>
              Find a transaction from that custodian that falls <S>inside the range the claim covered</S>{' '}
              and was not ingested.
            </>,
            <>
              File it as an ordinary <C>SINGLE_TX</C> submission through the same entrypoint, against
              the open incident.
            </>,
            <>
              The core verifies it exactly as it verifies any other evidence — the precompile, the
              index derivation, the decoder, all of it.
            </>,
            <>
              The accumulator <S>rolls back to its snapshot</S> and the prosecutor&rsquo;s bond becomes
              yours.
            </>,
          ],
        },
        {
          kind: 'statement',
          children: <>The fraud proof is an ordinary verified window. Watchtower&rsquo;s defence runs on Watchtower.</>,
        },
        {
          kind: 'p',
          children: (
            <>
              This is also why the replay guard had to be rule-scoped. The skipped transaction has
              already been seen by the system as stream evidence; a global guard would reject the very
              proof that catches the omission. See <A href="/docs/evidence">Evidence &amp; windows</A>.
            </>
          ),
        },

        { kind: 'h2', text: 'The bond' },
        {
          kind: 'table',
          head: ['', 'Value', 'Notes'],
          rows: [
            ['Posted per optimistic breach', '0.1 CTC', 'escrowed from the prosecutor'],
            ['Returned', 'on settlement', 'window closed unchallenged'],
            ['Slashed', 'to the challenger', 'a gap was proven inside the claimed range'],
          ],
        },
        {
          kind: 'p',
          children: (
            <>
              A prosecutor who files an incomplete stream loses money to whoever notices. A prosecutor
              who files a complete one is paid a bounty. Neither outcome requires anybody to be
              trusted, which is the point.
            </>
          ),
        },

        { kind: 'h2', text: 'Settling an unchallenged claim' },
        {
          kind: 'p',
          children: (
            <>
              Once the window closes without a successful challenge, <S>anyone</S> can settle the
              breach — the payout goes through and the bond returns. It is a permissionless call, so a
              claim cannot be left in limbo by a prosecutor who lost interest.
            </>
          ),
        },

        { kind: 'h2', text: 'Open breaches are counted, not flagged' },
        {
          kind: 'p',
          children: (
            <>
              A stream can break twice before anyone settles the first claim. Flipping a boolean would
              have thawed the tranche after the first payout while the second was still in dispute, so
              open breaches are a counter. Underwriters cannot exit a subject with{' '}
              <S>any</S> unresolved breach against it — see <A href="/docs/vault">The vault</A>.
            </>
          ),
        },

        { kind: 'h2', text: 'Trying it' },
        {
          kind: 'p',
          children: (
            <>
              <C>pnpm demo:skip-gap</C> stages the whole beat: it submits a deliberately incomplete
              stream step and prints the hash it stepped over. Paste that into the challenge panel on
              the incident it opened and watch the bond move.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `pnpm demo:skip-gap
# prints the skipped transaction hash - paste it into the Challenge panel

forge test --match-path test/unit/GapChallenge.t.sol -vv   # the same beat, offline`,
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'vault',
      title: 'The vault',
      lede: 'Cover, tranches, premiums, payouts, bounties and bonds — all the money, in one contract.',
      keywords: ['vault', 'cover', 'premium', 'stake', 'tranche', 'unstake', 'payout', 'usdToCtc'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              <C>UnderwritingVault</C> holds every position in the system. It is the only contract that
              moves value, and the only contract allowed to move it is{' '}
              <A href="/docs/architecture">WatchtowerCore</A> — a rule can compute a number but it can
              never reach the money.
            </>
          ),
        },

        { kind: 'h2', text: 'Cover' },
        {
          kind: 'p',
          children: (
            <>
              A policy is bought against one subject for a dollar amount. The premium is{' '}
              <S>1% of cover per 30 days</S>, quoted by reading <C>usdToCtc</C> from the vault and
              applying the contract&rsquo;s own formula — so the figure the interface shows is the
              figure the contract will demand. One signature, then nothing: you never file a claim,
              because the claim is the proof.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              A payout is capped three ways, and the smallest wins: by your cover, by the
              subject&rsquo;s staked tranche, and by the per-block payout cap.
            </>
          ),
        },

        { kind: 'h2', text: 'Tranches' },
        {
          kind: 'p',
          children: (
            <>
              Stake CTC to a subject&rsquo;s tranche and you are underwriting that specific risk.
              Premiums accrue as buyers arrive; payouts come out of the same pool. Risk is{' '}
              <S>per subject</S>, not pooled across the protocol, so backing a Chainlink feed does not
              expose you to a bridge.
            </>
          ),
        },
        {
          kind: 'note',
          tone: 'pending',
          title: 'Withdrawals freeze during a dispute',
          children: (
            <>
              Unstaking is blocked while the subject has any unresolved breach. Underwriters cannot
              exit between a proven violation and its settlement. The interface says so rather than
              silently disabling the button.
            </>
          ),
        },

        { kind: 'h2', text: 'Premiums are claimable' },
        {
          kind: 'p',
          children: (
            <>
              Premiums accrue per unit of stake at the moment cover is bought (<C>premiumPerShare</C>,
              settled against a per-staker debt), are paid by <C>claimPremiums</C>, and are carried
              automatically on <C>unstake</C>. A premium paid on a subject nobody is underwriting is
              parked in <C>unallocatedPremiums</C> rather than credited to whoever stakes next — that
              would pay somebody for risk they never carried.
            </>
          ),
        },

        { kind: 'h2', text: 'Bounty pools' },
        {
          kind: 'p',
          children: (
            <>
              Prosecutors are paid out of per-subject bounty pools, and anyone can top one up. Funding
              a watch is how a protocol, a DAO or an individual says <S>this contract should be
              watched</S> and puts money behind it. The multiplier is derived from the
              protocol&rsquo;s own cost curve — see <A href="/docs/bounties">Bounties</A>.
            </>
          ),
        },

        { kind: 'h2', text: 'Bonds' },
        {
          kind: 'p',
          children: (
            <>
              The vault also escrows the <C>0.1 CTC</C> bond behind every optimistic claim, returns it
              on settlement, and pays it to a successful challenger. See{' '}
              <A href="/docs/challenges">Challenges</A>.
            </>
          ),
        },

        { kind: 'h2', text: 'Seeded state' },
        {
          kind: 'p',
          children: (
            <>
              <C>pnpm seed</C> stakes 7 CTC across the three tranches, funds 1.25 CTC of bounty pools,
              and buys cover so a verdict has somewhere to pay — 8.30 CTC in total, which is capital
              you own inside the vault rather than a fee. It is idempotent: it reads what is already
              staked, funded and covered and tops up only the difference. Scale it with{' '}
              <C>SEED_SCALE_BPS</C> (<C>10000</C> is full).
            </>
          ),
        },

        { kind: 'h2', text: 'Known limits' },
        {
          kind: 'bullets',
          items: [
            <>
              <S>Solvency payouts go to a subject&rsquo;s first cover buyer.</S> <C>primaryHolder</C>{' '}
              is first-come-first-served and <C>ReserveConservation</C> returns no explicit
              beneficiary, so a second buyer on the same custodian would not be paid from a breach.
              Sandwich and failed-transaction verdicts name their beneficiary directly and are
              unaffected. Pro-rata settlement is the fix.
            </>,
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
      ],
    },

    /* ==================================================================== */
    {
      slug: 'bounties',
      title: 'Bounties & continuity length',
      lede: "The prosecutor's incentive, derived from the protocol's own gas curve rather than from a clock.",
      keywords: ['bounty', 'continuity', 'multiplier', 'freshness', 'checkpoint', 'cliff', 'incentive', 'gas'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              Somebody has to notice. Watchtower pays whoever does, out of the subject&rsquo;s bounty
              pool — and it pays <S>more for fresh evidence</S>, because fresh evidence is cheaper to
              prove and more useful to everyone.
            </>
          ),
        },

        { kind: 'h2', text: 'The signal is the proof itself' },
        {
          kind: 'p',
          children: (
            <>
              The number of continuity roots in a proof is exactly what the chain charges gas for.
              Evidence near a live attestation needs about ten hashes; evidence past the 24-hour
              checkpoint cliff needs roughly a thousand and costs about ten times as much.
            </>
          ),
        },
        {
          kind: 'statement',
          children: (
            <>
              Watchtower reads freshness off the proof rather than off a clock. No oracle, no
              timestamp, nothing to game.
            </>
          ),
        },
        {
          kind: 'table',
          head: ['Continuity roots', 'Multiplier', 'What it means'],
          rows: [
            ['≤ 100', '1.00×', 'near a live attestation'],
            ['≤ 900', '0.50×', 'aging'],
            ['> 900', '0.20× + gas', 'past the checkpoint cliff'],
          ],
        },
        {
          kind: 'p',
          children: (
            <>
              Implemented in <C>contracts/src/core/UnderwritingVault.sol</C>. The prosecutor&rsquo;s
              incentive curve is the protocol&rsquo;s cost curve, which means the two can never drift
              apart.
            </>
          ),
        },

        { kind: 'h2', text: 'Who can be a prosecutor' },
        {
          kind: 'p',
          children: (
            <>
              Anyone. <A href="/prosecute">/prosecute</A> offers two modes: <S>relayed</S>, where the
              worker builds the proof, pays the gas and takes the bounty — no wallet required — and{' '}
              <S>sign it myself</S>, where the worker hands back ready-to-sign calldata and the bounty
              is yours. Neither can forge anything: the ASC re-verifies every proof inside the settling
              transaction, so a dishonest submission reverts rather than pays.
            </>
          ),
        },

        { kind: 'h2', text: 'Funding a pool' },
        {
          kind: 'p',
          children: (
            <>
              Any subject page has a <S>Fund a watch</S> panel, and <C>pnpm watch</C> does it from a
              shell in one command. The leaderboard at <A href="/vault">/vault</A> ranks prosecutors by
              submissions and bounties taken. See <A href="/docs/fund-a-watch">Fund a watch</A>.
            </>
          ),
        },
      ],
    },
  ],
};
