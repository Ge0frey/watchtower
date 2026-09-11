# Watchtower

### Proof-native insurance for Ethereum, underwritten on Creditcoin.

Watchtower pays you when Ethereum takes your money — and it never takes your word for it. Every claim
is a cryptographic proof of an Ethereum transaction, verified on Creditcoin by the Attestcoin
Protocol's Block Prover Precompile, priced, and settled in a single block. No claims adjuster, no
oracle operator, no multisig, no trusted watcher.

Built for **BUIDL CTC 2026 Fall** — RWA track (primary), DeFi track (secondary).

---

## The one idea

An Ethereum contract **cannot see the transactions beside it in its own block**, and cannot audit a
custodian's whole history inside one transaction. Both facts are provable; neither is reachable from
the source chain.

The Attestcoin Protocol's precompile will verify *any* Ethereum transaction, and it exposes
`calculateTxIndex` — the transaction's position inside its block. Combine that with batch proofs and a
Creditcoin contract can prove statements about **Ethereum's execution order**.

> A Creditcoin contract can see what an Ethereum contract cannot: its neighbours.

Watchtower turns that into insurance that pays out on proof alone.

## What it proves today

| Rule | Claim | Evidence window | Settlement |
|---|---|---|---|
| **IntraBlockExtraction** | A searcher bracketed a victim's swap — three consecutive indices in one block, same pool, round trip in profit | 3 adjacent | instant |
| **ReserveConservation** | A custodian minted more than it locked | ordered stream ≤ 10 | optimistic + challengeable |
| **ChainlinkFeed** | The price Chainlink itself published, proven not reported | ordered stream | n/a (source rule) |
| **FailedTx** | A transaction reverted and burned gas for nothing | 1 | instant |

Four rules, one engine. Adding a fifth risk means writing one pure function.

## Repository

```
contracts/          Foundry. The ASC, the rule library, the vault. 65 tests.
packages/shared/    Chain config, rule ids, types, generated ABIs.
packages/attestcoin/ Every conversation with the protocol: SDK client, proofs, pre-flight, gas.
apps/prosecutor/    The worker: three scanners, one submission path, indexer, REST + SSE.
apps/web/           The dashboard. One screen.
docs/               Integration doc, architecture, demo runbook.
```

## Quick start

See [`docs/ENV_SETUP.md`](docs/ENV_SETUP.md) for where every `.env` value comes from — only three of
them are things you create.

```bash
pnpm install
cp .env.example .env          # see docs/ENV_SETUP.md

# contracts  (see docs/DEPLOY.md for the order and what to paste where)
cd contracts && forge test                       # 66 tests, no network needed
forge script script/DeploySepolia.s.sol    --rpc-url sepolia    --broadcast
forge script script/DeployCreditcoin.s.sol --rpc-url creditcoin --broadcast
forge script script/SeedDemo.s.sol         --rpc-url creditcoin --broadcast

# verify the integration against the live chain, not against the docs
pnpm --filter @watchtower/attestcoin verify:precompile
pnpm thesis 0xFRONTRUN 0xVICTIM 0xBACKRUN         # a real mainnet sandwich

# run it
pnpm worker                                       # prosecutor + API on :8080
pnpm web                                          # dashboard on :3000
```

The dashboard renders fully with **no wallet connected**. Only buying cover, staking and funding a
watch need one.

## Verification you can reproduce

Two checks confirm the integration against the live chain rather than against documentation.

**The precompile's index derivation** — this is what makes the offline test suite trustworthy, since
Creditcoin's precompile is native runtime code that a forked node does not have:

```
$ pnpm --filter @watchtower/attestcoin verify:precompile

Block Prover Precompile 0x0FD2 on chainId 102031
  expected   46   precompile   46   MATCH
  expected   47   precompile   47   MATCH
  expected   48   precompile   48   MATCH
  ...
The precompile uses the same convention as MockBlockProver.
The offline unit suite is faithful to on-chain behaviour.
```

**The chainKey mapping**, asserted at worker boot — the worker refuses to start if it is wrong:

```
WATCHTOWER prosecutor
  creditcoin      chainId 102031
  attestcoin      chainKey 1 -> Sepolia, chainKey 3 -> Mainnet
```

Mainnet being readable from a testnet deployment is what lets Watchtower prosecute **real, historical
Ethereum sandwiches** in a demo.

## Architecture in one paragraph

One entrypoint handles every risk. `WatchtowerCore.submitEvidence` verifies a window through the
precompile's batch overload, derives each transaction's index with `calculateTxIndex`, decodes
receipts, applies a rule-scoped replay guard, enforces the window shape the rule declared, and calls
`rule.evaluate` — which is `view`, so it is reached by STATICCALL and cannot write state or move
money. Instant rules settle immediately. Stream rules open a bonded claim with a challenge window,
because completeness cannot be proven on-chain; anyone who shows a skipped transaction inside the
claimed range rolls the accumulator back and takes the bond. That fraud proof is itself an ordinary
verified window — **Watchtower's defence runs on Watchtower**.

See [`docs/USER_FLOW.md`](docs/USER_FLOW.md) for what a person actually does with it,
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how it is built, and
[`docs/ATTESTCOIN_INTEGRATION.md`](docs/ATTESTCOIN_INTEGRATION.md) for the protocol integration.

## What we are honest about

- **You cannot prove a negative on-chain.** Sandwich claims are self-contained and settle instantly.
  Solvency claims depend on stream completeness, so they are bonded, challengeable and economically
  secured rather than self-evident. The asymmetry is a design feature, stated rather than hidden.
- **Attestation takes about eight minutes end to end**, not the ~2-minute attestation cadence. The UI
  narrates the wait; the demo stages evidence ahead of time.
- **No state proofs exist**, so every balance is replayed from a proven event stream against an anchor.
- **Damages are a documented model, not a reconstruction.** The sandwich figure is the attacker's
  round-trip gain on the same pool in the same block — a lower bound, since it ignores the fee they
  paid. The *verdict* is proven; the *pricing* is policy.
- **EIP-1559 gas reimbursement uses `maxFeePerGas`**, an upper bound, because the encoding does not
  carry the effective price. Capped by the policy either way.
- **Ethereum only, today.** Every source chain the protocol adds becomes a new subject namespace for
  free.
- **Writability is in audit.** Architected for, not demoed on.
- **Solvency payouts go to a subject's first cover buyer.** `primaryHolder` is first-come-first-served
  and `ReserveConservation` returns no explicit beneficiary, so a second buyer on the same custodian
  would not be paid from a breach. Sandwich and failed-transaction verdicts name their beneficiary
  directly and are unaffected. Pro-rata settlement is the fix.

## Licence

MIT.
