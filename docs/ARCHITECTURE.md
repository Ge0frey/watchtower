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

```
/                  overview - what this is, headline state, latest verdicts
/subjects          the catalogue
/subjects/[id]     detail + buy cover + stake + fund a watch
/incidents         the archive, filterable by rule and status
/incidents/[id]    full-size block strip, evidence, verdict, challenge panel
/vault             tranches, your positions, prosecutor leaderboard
/prosecute         console - relayed or self-signed, with live pipeline narration
```

`AmbientHeader` keeps the proven head, the proven price, the prosecutor's balance and the feed status
in the chrome on every route, so navigation never costs the sense that the system is live. One
`useChainState` query is shared through TanStack Query's cache, so moving between pages reuses a
single multicall.

## Deployment order

Registry → Vault → Core → Rules. Rules read prices through the core's `IAttestedFeed`, so they are
deployed last. There is no circularity: the core discovers rules through the registry at call time.
No library linking — `EvmV1Decoder` is `internal` and inlines.
