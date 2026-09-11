# Deviations from the execution plan

Six things differ from `watchtowerplan.md`. Each was a decision made while building, with the
reason recorded here rather than left to be discovered.

## 1. Worker persistence is a JSON file, not Postgres + Drizzle

**Plan:** Postgres 16 with Drizzle ORM.
**Built:** an atomically-replaced JSON store behind the same interface, with `src/db/schema.sql`
carrying the identical shape for Postgres.

**Why:** the plan's own requirement is that the worker survives a restart and replays in-flight
candidates — which the file store does, using a write-to-temp-then-rename so a crash mid-write cannot
corrupt it. What Postgres adds is *shared* state across several workers, which no part of the demo
needs. Against that, a hard database dependency means the project cannot be cloned and run, and a
demo that needs infrastructure to boot is a demo that can fail on stage. The interface is unchanged,
so swapping drivers later touches no caller.

## 2. No `wagmi/connectors` import

**Plan:** RainbowKit with an injected connector.
**Built:** wagmi's EIP-6963 auto-discovery, no connector package.

**Why:** `wagmi/connectors` pulls in `@base-org/account` → `@coinbase/cdp-sdk` → `@x402/evm`, which is
not published, and the Next.js build fails outright. Auto-discovery finds injected wallets without
the barrel import. The dashboard is read-first anyway — everything renders with no wallet connected,
and only buying cover, staking and funding a watch need one.

## 3. Rules read prices through `IAttestedFeed`

**Plan:** rules receive the subject's own accumulator price.
**Built:** subjects carry a `priceSubject` pointer, and rules resolve the dollar price through the
core's `IAttestedFeed` interface.

**Why:** it surfaced immediately in testing. The price lives on the *feed* subject; the pool and the
custodian are different subjects with their own accumulators, so a sandwich verdict on the pool had no
dollar figure to use. Pointing each priced subject at the feed subject fixes it — and it means the
rules consume the same read interface Watchtower exposes to any other Creditcoin contract, which is a
better answer than passing a number around.

## 4. Creditcoin deployment runs on ethers, not `forge script`

**Plan:** `forge script ... --broadcast` for every deployment.
**Built:** `contracts/script/DeployCreditcoin.s.sol` and `SeedDemo.s.sol` are kept as the readable
specification; `scripts/deploy-creditcoin.mjs` and `scripts/seed-demo.mjs` are what actually run.

**Why:** Creditcoin's RPC omits `mixHash` from block headers, so alloy cannot deserialise a block and
`forge script` — which forks the chain to execute `run()` and to follow receipts — fails. The
dangerous part is *how* it fails: it broadcasts transactions it can then no longer track. The first
attempt left three receipts out of nineteen transactions and a half-deployed system. ethers needs only
`eth_sendRawTransaction` and `eth_getTransactionReceipt`, both served correctly. The rewrite also made
both steps idempotent, which `forge script` never was.

The same header quirk is why `foundry.toml` pins `evm_version = "london"`: post-merge specs demand
`prevrandao`, which this chain's headers do not carry.

## 5. `proofProvider.mergeProofs` is not used

**Plan:** merge contiguous continuity proofs for stream catch-up across chunks.
**Built:** each chunk is submitted as its own window with its own shared continuity proof.

**Why:** merging pays off when several chunks are combined into *one* submission. They cannot be: the
protocol's batch ceiling is ten transactions, which is also the ceiling on one window, so a catch-up
of thirty transactions is three submissions regardless. Each already carries exactly one continuity
proof — the cheapest shape the protocol offers — and merging them would produce a proof no call could
use. The helper is real and correct; this system has no call site for it.

## 6. `FailedTx` reads transaction types 0, 1 and 2 only

**Plan:** silent on transaction types.
**Built:** legacy, EIP-2930 and EIP-1559 are decoded; blob (3) and delegation (4) transactions revert
with `UnsupportedTxType(txType)`.

**Why:** `EvmV1Decoder` ships helpers for types 0 and 2 only. Type 1 is a three-chunk transaction with
a documented `Type1Fields` layout, so it is read directly from its chunk — refusing an ordinary
access-list transaction would be a bug, not a policy. Types 3 and 4 carry a fourth chunk whose split
the decoder does not expose; guessing at it would reimburse from the wrong field, so they are refused
by name instead. Stated in the README's limitations rather than left to be discovered by a judge
pasting a blob transaction.

---

## Additions the plan did not specify

- **Premiums are claimable.** The plan's vault tracked `premiumsEarned` but had no path to collect it,
  which makes "stake to a tranche and earn premiums" a claim the contract could not honour. Premiums
  now accrue per unit of stake at the moment cover is bought (`premiumPerShare`, settled against a
  per-staker debt), are paid out by `claimPremiums`, and are carried automatically on `unstake`. A
  premium paid on a subject nobody is underwriting is parked in `unallocatedPremiums` rather than
  credited to whoever stakes next — that would pay for risk they never carried.
- **Open breaches are counted, not flagged.** A stream can break twice before anyone settles the
  first claim; flipping a boolean would have thawed the tranche after the first payout while the
  second was still in dispute.
- **Scanners hold no cursor of their own.** Each tick reads the proven cursor from Creditcoin and
  works forward from it, so progress is only ever recorded by a confirmed receipt. The plan's
  "commit the cursor only after an on-chain receipt" is stronger stated this way: there is no local
  cursor left to get ahead of the chain. `lastScanned` survives only as a *nothing-here* watermark.
- **`fixtures/` is replayed by the test suite.** `FixtureReplay.t.sol` asserts that the index derived
  from a real Merkle sibling path equals the one the Proof Builder reported, and that the real receipt
  bytes decode — the Day-1 thesis, committed as a test rather than left in a script's output.

---

## What the plan got right and the build confirmed

- **Batch verification is exposed to Solidity** — `verifyAndEmit(uint64, uint64[], bytes[], MerkleProof[], ContinuityProof)`. One call per window, one shared continuity proof.
- **`calculateTxIndex` is a precompile function.** No sibling-path arithmetic was written. And the live precompile derives indices with exactly the convention `MockBlockProver` implements, verified for indices 0…4095 — which is what makes the offline suite trustworthy.
- **`EvmV1Decoder` is `internal`-only** — inlines, no library linking, and the deployed decoder address is irrelevant.
- **`via_ir = true` is mandatory.** Omitting it fails with "stack too deep".
- **The rule-scoped replay guard was necessary**, exactly as predicted: `test_sameTransactionServesStreamAndChallenge` fails outright with a global guard.
- **Argument evaluation consumes a Foundry prank.** `makeAddr` is a cheatcode call, so building evidence inline in a `vm.prank(...)` call sent transactions from the test contract instead of the prosecutor. Every test now builds its input first, then pranks.
