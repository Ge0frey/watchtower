# Deviations from the execution plan

Three things differ from `watchtowerplan.md`. Each was a decision made while building, with the
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

---

## What the plan got right and the build confirmed

- **Batch verification is exposed to Solidity** — `verifyAndEmit(uint64, uint64[], bytes[], MerkleProof[], ContinuityProof)`. One call per window, one shared continuity proof.
- **`calculateTxIndex` is a precompile function.** No sibling-path arithmetic was written. And the live precompile derives indices with exactly the convention `MockBlockProver` implements, verified for indices 0…4095 — which is what makes the offline suite trustworthy.
- **`EvmV1Decoder` is `internal`-only** — inlines, no library linking, and the deployed decoder address is irrelevant.
- **`via_ir = true` is mandatory.** Omitting it fails with "stack too deep".
- **The rule-scoped replay guard was necessary**, exactly as predicted: `test_sameTransactionServesStreamAndChallenge` fails outright with a global guard.
- **Argument evaluation consumes a Foundry prank.** `makeAddr` is a cheatcode call, so building evidence inline in a `vm.prank(...)` call sent transactions from the test contract instead of the prosecutor. Every test now builds its input first, then pranks.
