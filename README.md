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
contracts/          Foundry. The ASC, the rule library, the vault. 79 tests, fuzzed invariants.
packages/shared/    Chain config, rule ids, types, generated ABIs.
packages/attestcoin/ Every conversation with the protocol: SDK client, proofs, pre-flight, gas.
apps/prosecutor/    The worker: three scanners, one submission path, indexer, REST + SSE.
apps/web/           Next.js. A landing page, the application, and /docs - the documentation itself.
fixtures/           Proof bundles captured from the live testnet, replayed by the test suite.
```

## Quick start

The documentation lives in the application itself, at [`/docs`](https://watchtower-attestation.vercel.app/docs) — run `pnpm web` and open
it locally, or read it on the deployed site. [Environment](https://watchtower-attestation.vercel.app/docs/environment) covers where every
`.env` value comes from; only three of them are things you create.

```bash
pnpm install
cp .env.example .env          # see /docs/environment

# contracts  (see /docs/deploy for the order and what to paste where)
cd contracts && forge test                       # 79 tests, no network needed
forge script script/DeploySepolia.s.sol --rpc-url sepolia --broadcast
cd .. && pnpm deploy:creditcoin                  # NOT forge script - see /docs/deploy
pnpm seed

# verify the integration against the live chain, not against the docs
pnpm verify:precompile
pnpm thesis 0xFRONTRUN 0xVICTIM 0xBACKRUN         # a real mainnet sandwich
pnpm capture 0xFRONTRUN 0xVICTIM 0xBACKRUN        # freeze it into fixtures/ for the test suite

# run it
pnpm worker                                       # prosecutor + API on :8080
pnpm web                                          # dashboard on :3000

# ops
pnpm stage:sandwich                               # find a real sandwich, register it, get a paste-ready link
pnpm find:sandwich --span 150                     # a real sandwich happening right now
pnpm watch 0xPOOL --label "UniV2 DAI/WETH"        # register + fund a watch on any contract
pnpm retire 0xPOOL                                # take a subject out of the dropdown again
pnpm demo:skip-gap                                # stage a stream step with a hole in it
pnpm balances                                     # every key, on the chain it spends on
```

Every command, and when to reach for which, is in [Scripts](https://watchtower-attestation.vercel.app/docs/scripts).

`/` is the landing page — the argument, with two live numbers read off Creditcoin by the browser so
the claim is checkable before anything is explained. `/dashboard` is where the application starts.

Everything renders fully with **no wallet connected**. Only buying cover, staking, claiming premiums
and funding a watch need one.

## It is live

Deployed on Creditcoin CC3 Testnet (chain id 102031), reading Ethereum Mainnet and Sepolia.

| | |
|---|---|
| `WatchtowerCore` | [`0x8864…8DF2`](https://creditcoin-testnet.blockscout.com/address/0x886498645c18a787f6283c25012771d77b068DF2) |
| `SubjectRegistry` | [`0x063f…8178`](https://creditcoin-testnet.blockscout.com/address/0x063f5167Fe6F65c5B8c9F81862fE92678f248178) |
| `UnderwritingVault` | [`0x5c9F…5A14`](https://creditcoin-testnet.blockscout.com/address/0x5c9F0cF5D0057556B1A12D8f4028253c1f1C5A14) |
| `DemoBridge` (Sepolia) | [`0x4044…A5eF`](https://sepolia.etherscan.io/address/0x4044D34f8DF534B364B5EA337b72DD508198A5eF) |

**A real Ethereum mainnet sandwich, prosecuted on Creditcoin:**
[`0x9cad…9308`](https://creditcoin-testnet.blockscout.com/tx/0x9cad4c89ea95410e08896de3ae35d96a978348a9cc1a082824377f5505d29308)

Block 25,955,190 of Ethereum Mainnet, transaction indices 29, 30, 31 on the UniV2 DAI/WETH pool. A
searcher bracketed a stranger's swap and took 0.001467 WETH out of their execution price. Watchtower
proved all three positions through the Block Prover Precompile in one batch call, priced the damage at
**$3.77** using the ETH/USD answer Chainlink itself published — proven, not reported — and paid the
prosecutor 0.05 CTC for the proof. The whole prosecution cost 1,233,005 gas: **1.64 % of one
Creditcoin block**.

Restitution was zero, and that is the system working: the victim is a real stranger who never bought
cover. The verdict stands on its own; insurance pays the insured.

## Verification you can reproduce

Two checks confirm the integration against the live chain rather than against documentation.

**The precompile's index derivation** — this is what makes the offline test suite trustworthy, since
Creditcoin's precompile is native runtime code that a forked node does not have:

```
$ pnpm verify:precompile

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

**The thesis itself, as a committed test.** `pnpm capture <txHash>…` freezes a real proof bundle into
`fixtures/`; `FixtureReplay.t.sol` then replays it offline and asserts that the transaction index
derived from the *real* Merkle sibling path equals the index the Proof Builder reported, and that
`EvmV1Decoder` decodes the *real* receipt bytes:

```
$ forge test --match-path test/unit/FixtureReplay.t.sol -vv

  replaying fixtures/mainnet-sandwich.json
    block 25955190 index 29    from 0xB70103800e9f2A71caf7796CbF69d238F4823a02   logs 4
    block 25955190 index 30    from 0x4f545A779D1C1874313C893Ca3e0Fc64CeCDA196   logs 35
    block 25955190 index 31    from 0xB70103800e9f2A71caf7796CbF69d238F4823a02   logs 4
```

One block. Consecutive positions. The same sender on both outer positions and a stranger in the
middle. Every coordinate there was derived by the precompile from a real Merkle sibling path, and
every address by decoding real transaction bytes — the test asserts that shape, so the thesis is a
passing assertion rather than a claim in a README.

Every other suite uses synthesised transactions, which proves the logic and not the decoding. This
one proves the decoding. It skips, loudly, when no fixture has been captured — a fresh clone with no
API keys still runs the full offline suite green.

## Architecture in one paragraph

One entrypoint handles every risk. `WatchtowerCore.submitEvidence` verifies a window through the
precompile's batch overload, derives each transaction's index with `calculateTxIndex`, decodes
receipts, applies a rule-scoped replay guard, enforces the window shape the rule declared, and calls
`rule.evaluate` — which is `view`, so it is reached by STATICCALL and cannot write state or move
money. Instant rules settle immediately. Stream rules open a bonded claim with a challenge window,
because completeness cannot be proven on-chain; anyone who shows a skipped transaction inside the
claimed range rolls the accumulator back and takes the bond. That fraud proof is itself an ordinary
verified window — **Watchtower's defence runs on Watchtower**.

The full documentation is a route in the application: [`/docs`](https://watchtower-attestation.vercel.app/docs) — thirty-odd pages covering
the concepts, what a person actually does with it, the on-chain program, the worker, and how to
deploy and operate the whole thing. Start with [The whole flow](https://watchtower-attestation.vercel.app/docs/end-to-end),
[Architecture](https://watchtower-attestation.vercel.app/docs/architecture) and [Attestcoin Protocol](https://watchtower-attestation.vercel.app/docs/attestcoin).

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
  carry the effective price. Capped by the policy either way. `FailedTx` reads transaction types 0, 1
  and 2; blob (3) and delegation (4) transactions are refused by name rather than decoded from a
  chunk layout the protocol's decoder does not expose.
- **Ethereum only, today.** Every source chain the protocol adds becomes a new subject namespace for
  free.
- **Writability is in audit.** Architected for, not demoed on.
- **Solvency payouts go to a subject's first cover buyer.** `primaryHolder` is first-come-first-served
  and `ReserveConservation` returns no explicit beneficiary, so a second buyer on the same custodian
  would not be paid from a breach. Sandwich and failed-transaction verdicts name their beneficiary
  directly and are unaffected. Pro-rata settlement is the fix.

## Licence

MIT.
