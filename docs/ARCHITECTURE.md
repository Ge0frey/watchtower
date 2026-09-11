# Architecture

## Four planes

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  SOURCE — Ethereum                                                            │
│  Mainnet (chainKey 3): real pools, real sandwiches, Chainlink aggregators      │
│  Sepolia (chainKey 1): DemoBridge.sol — the staged custodian                  │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │ eth_getLogs / eth_getBlock
┌───────────────▼──────────────────────────────────────────────────────────────┐
│  EVIDENCE — prosecutor worker (untrusted)                                     │
│  scanners → queue → waitUntilHeightAttested → getBatchProof → pre-flight       │
│  → submitEvidence.  Also indexes our own events for the dashboard.            │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │ eth_sendRawTransaction (chainId 102031)
┌───────────────▼──────────────────────────────────────────────────────────────┐
│  SETTLEMENT — Creditcoin CC3 Testnet                                          │
│  WatchtowerCore ── verifyAndEmit / calculateTxIndex ──► Precompile 0x0FD2     │
│                 ── evaluate (STATICCALL) ─────────────► rule library          │
│                 ── settle ────────────────────────────► UnderwritingVault     │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │ viem reads · wagmi writes · SSE narration
┌───────────────▼──────────────────────────────────────────────────────────────┐
│  PRESENTATION — one dashboard                                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Trust boundaries

- **The worker is untrusted.** It assembles proofs and pays gas. It cannot forge a verdict: the
  precompile verifies everything inside the settling transaction. A lying worker gets a revert.
- **Rules are untrusted.** `evaluate` is `view`, so the core reaches it by STATICCALL. A rule cannot
  write state or move money, and its worst case — a wrong judgement — is bounded by the subject's
  per-block payout cap. `test_maliciousRuleCannotMutateStateOrDrainVault` proves it with a hostile
  rule that matches the selectors but declares `evaluate` state-mutating.
- **The frontend is untrusted.** Every number that decides money is read from Creditcoin directly.
  The worker API supplies history and enrichment only; if they disagree, the chain wins.
- **The worker's store is a cache.** Delete it and the system still works — only charts go dark.

## Contracts

| Contract | Responsibility |
|---|---|
| `WatchtowerCore` | The ASC. The only contract that calls the precompile, and the only one that may move the vault. |
| `SubjectRegistry` | The catalogue: which risks exist, which rules may judge them, what a mistake can cost. |
| `UnderwritingVault` | Cover, tranches, premiums, payouts, prosecutor bounties, bonds and slashing. |
| `IntraBlockExtraction` · `ReserveConservation` · `ChainlinkFeed` · `FailedTx` | Pure judgement. |
| `EvidenceLib` · `SubjectKey` · `SwapMath` · `PriceLib` | Window discipline, replay keys, damages, price resolution. |
| `DemoBridge` · `DemoToken` | Sepolia-side staging for the demo. |
| `MockBlockProver` · `MaliciousRule` | Test doubles. |

### The one entrypoint

```solidity
function submitEvidence(EvidenceInput calldata input) external payable returns (bytes32 incidentId);
```

1. load the subject and rule; reject a rule not bound to the subject, a paused subject, a wrong chainKey
2. verify the window — batch overload when it has more than one transaction
3. derive each `txIndex` from `calculateTxIndex`
4. decode `from` / `to` / receipt status with `EvmV1Decoder`
5. sort by `(blockHeight, txIndex)` and apply the rule-scoped replay guard
6. enforce the rule's declared window shape
7. `rule.evaluate(...)` — STATICCALL
8. apply the accumulator delta
9. settle instantly, or open a bonded claim with a challenge window
10. emit `EvidenceAccepted` and `VerdictIssued` / `BreachOpened`

A sandwich prosecution, a reserve ingestion, a price update, a gas-refund claim and a fraud proof are
all this one call with different rule ids.

### Storage: nothing kept that need not be

Horizontal evidence is verified, judged and discarded in one transaction — one verdict record remains.
Stream rules persist only aggregates: `locked`, `minted`, `price`, and the cursor. Constant size, no
matter how much history has been ingested.

### Instant versus optimistic

| | Sandwich | Solvency |
|---|---|---|
| Soundness | self-contained — the three proofs *are* the claim | depends on stream completeness |
| Settlement | `INSTANT` | `OPTIMISTIC` — bonded, with a challenge window |
| Defence | none needed | gap challenge: prove a skipped transaction inside the claimed range → accumulator rolls back, bond goes to the challenger |

The gap challenge is a `SINGLE_TX` submission through the same entrypoint.

## Worker

One process: three scanners (intra-block, reserve stream, price feed), one single-flight queue in
front of the hot key, one submission path, one indexer, one API.

Durability follows the protocol's own guidance for readability workers: candidates move through
`DETECTED → AWAITING_ATTESTATION → PROVING → PREFLIGHT → SUBMITTED → CONFIRMED | FAILED | UNPROVABLE`,
the store is written atomically, cursors advance only after a confirmed receipt, and anything
non-terminal is replayed on boot.

Default persistence is an atomically-replaced JSON file, so the worker runs with no infrastructure.
`src/db/schema.sql` is the same shape in Postgres for when several workers share state.

## Frontend

| Need | Channel |
|---|---|
| Reserves, cover, vault balances, proven head, price | **viem multicall → Creditcoin**, 3s poll. Authoritative. |
| Incident history, decoded evidence, candidates, leaderboard | **worker REST**. Presentation only. |
| Live pipeline narration | **worker SSE**. The attestation wait runs to minutes. |
| Buy cover, stake, fund a watch | **wagmi → user wallet** |
| Prosecute | **POST /api/prosecute** — `relayed` (worker pays) or `self` (returns calldata) |

`BlockStrip` renders every incident type: intra-block lights three adjacent cells with the untouched
neighbours dimmed; stream lights a run across blocks with the cursor marked and any gap punched out.

### Routes

Two shells, because a first-time reader and an operator want opposite things.

```
(marketing)
/                  the landing page - the argument, then one door into the product

(app)
/dashboard         what the system has proven, is watching, and last judged
/subjects          the catalogue
/subjects/[id]     detail + buy cover + stake + fund a watch
/incidents         the archive, filterable by rule and status
/incidents/[id]    full-size block strip, evidence, verdict, challenge panel
/vault             tranches, your positions, prosecutor leaderboard
/prosecute         console - relayed or self-signed, with live pipeline narration
```

`app/(marketing)` gets a thin header and a footer: someone meeting Watchtower for the first time
should get the argument, not a toolbar of five tools they have no context for. `app/(app)` gets
`AppHeader`, which keeps the proven head, the proven price and the prosecutor's balance in the chrome
on every route — the ambient state is what makes the system look alive, and navigation should never
cost it.

One `useChainState` query is shared through TanStack Query's cache, so moving between pages reuses a
single batched read rather than starting another.

### Design system

`app/globals.css` is the whole of it: Tailwind v4 with an `@theme` block of semantic tokens, and no
`tailwind.config.js`. The rules it encodes:

- **Warm paper ground, hairline rules, no shadows.** The application is a forensic document, so it
  is set on paper rather than on the near-black every other chain explorer uses. Depth is a 1px rule
  and a three-step paper scale — recessed `paper-dim`, page `paper`, raised `card`. Square corners
  everywhere.
- **Colour is semantic, never decorative.** `proven` (sage `#7d8f6a`, with `accent-deep` `#556047`
  as its readable cut for type) means the precompile verified it; `breach` vermilion, `pending`
  amber, `settled` green. Nothing speculative is ever sage, which is what keeps the accent meaning
  something by the time it lands on a verdict.
- **The highlighter is spent twice on the whole site** — the claim in the headline and the
  coordinate the system turns on. Everywhere else the accent is type or a rule. An accent that
  appears eight times on a page is a decoration, not an assertion.
- **The victim cell is ink, not red.** In a sandwich strip the victim is the subject of the claim,
  not a failure, and a second warm colour beside the accent reads as a clash. Red stays reserved for
  states that really are wrong: a shortfall, a rolled-back verdict, a stale continuity proof.
- **Tone lives in a small dot, a label and type — never in a filled panel or a coloured edge.** A
  filled tint block is the single most dated thing a paper interface can do; a thick coloured bar
  down one side is the second. `Notice` is a hairline card carrying a 6px tone dot, the same object
  the worker banner uses.
- **Disabled is a flat grey control**, never a faded accent. A washed-out accent button reads as
  broken rendering rather than as "not yet".
- **Cards are bento, not a row of boxes.** `Bento` is a twelve-column bed; `BentoCard` takes a span,
  a `paper` or `ink` surface, and an oversized glyph anchored to its bottom-right corner. Four moves
  carry it: unequal spans so the layout states a hierarchy, one inverted cell per group for rhythm,
  content anchored to the bottom so the empty top half does the breathing, and a glyph at an opacity
  that keeps it texture. One graphic per card — a ring behind a numeral was two decorations
  competing. The reference sheets' soft gradient washes were deliberately not taken: a blurred
  colour bloom belongs to a different design language than hairline rules and one flat accent.
- **One grotesque, two jobs.** Archivo carries every size, separated by weight and scale rather than
  by a second family — and mono carries *anything the chain produced*: every coordinate, hash, amount
  and label. That single rule is what makes proven data look different from copy we wrote.
- **One thing moves: evidence arriving, once.** There is no pulse, no blink and no breathing status
  dot anywhere — a live system proves it is live by changing its numbers, not by twitching at the
  reader. The hero's orbit rings are the single exception and turn slowly enough to read as drawing.
  `prefers-reduced-motion` turns all of it off.
- **Soft corners, not sharp.** `--radius-sm/md/lg` at 4/8/12px. Evidence cells stay nearly square —
  they are slots in a block, and a slot that looks like a button reads as one.

`components/ui/index.tsx` holds the primitive vocabulary — `Panel`, `Section`, `Stat`, `Badge`,
`Row`, `Button`, `Field`, `Notice`, `Empty`, `PageHead`, `SectionHead`, `ProvenMark`, `ArrowLink`.
Every screen is built from these, so a panel on the vault page and a panel on an incident page are
the same object. The `shell` utility sets one horizontal measure for every route, so the left edge of
a heading never moves as you navigate.

## Deployment order

Registry → Vault → Core → Rules. Rules read prices through the core's `IAttestedFeed`, so they are
deployed last. There is no circularity: the core discovers rules through the registry at call time.
No library linking — `EvmV1Decoder` is `internal` and inlines.
