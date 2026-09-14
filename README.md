[![Watchtower demo](https://img.youtube.com/vi/K46waI5e-Co/maxresdefault.jpg)](https://youtu.be/K46waI5e-Co)

# Watchtower

**Watchtower is a Creditcoin USC turning attestation into insurance against MEV and sandwich attacks on Ethereum. Its Block Prover precompile verifies attested foreign txs and their position, so the claim is the proof, judged and paid in one Creditcoin block. Currently, Watchtower insures users against MEV bot activity and sandwich attacks on Ethereum, and we are working to extend it to other chains.**

## Quick links

- Docs: https://watchtower-attestation.vercel.app/docs
- Live app: https://watchtower-attestation.vercel.app
- Demo video: https://youtu.be/K46waI5e-Co
- Whitepaper: https://watchtower-attestation.vercel.app/watchtower-whitepaper.pdf
- Prosecuted mainnet sandwich: https://creditcoin-testnet.blockscout.com/tx/0x9cad4c89ea95410e08896de3ae35d96a978348a9cc1a082824377f5505d29308
- WatchtowerCore: https://creditcoin-testnet.blockscout.com/address/0x886498645c18a787f6283c25012771d77b068DF2
- Prosecutor health: https://watchtower-prosecutor.onrender.com/api/health

Built for BUIDL CTC 2026 Fall. DeFi track primary, RWA track secondary.

## The one idea

A contract on Ethereum cannot see the transactions beside it in its own block. That single
blind spot is why sandwich attacks are forensic commentary rather than an enforceable claim,
and it is not a gap any Ethereum contract can close for itself.

Creditcoin closes it. The Attestcoin Protocol ships a Block Prover Precompile at `0x0FD2` as
native runtime code, and it will verify any Ethereum transaction against an attested block.
Nothing binds that transaction to the contract asking about it, so a Creditcoin contract can
adjudicate other people's protocols on behalf of other people's users. Most importantly, the
precompile exposes `calculateTxIndex`, which returns a transaction's position inside its block.

> A Creditcoin contract can see what an Ethereum contract cannot: its neighbours.

Watchtower turns that into insurance that pays out on proof alone. There is no claims adjuster,
no oracle operator, no multisig and no trusted watcher. Every claim is a cryptographic proof of
an Ethereum transaction, verified on Creditcoin, priced against a Chainlink answer this system
proved for itself, and settled in the same block that proved the harm.

## Creditcoin is the product, not the host

`WatchtowerCore` is a Universal Smart Contract. It is the only contract in the system that
speaks to the precompile, and the only one allowed to move the vault. It deliberately does not
inherit the protocol's reference contract: that one verifies a single transaction and dedupes
globally, while Watchtower needs batch windows sharing one continuity proof and a rule-scoped
replay guard, because one Ethereum transaction is legitimately evidence under several rules at
once.

The integration uses effectively the whole readability surface. Batch `verifyAndEmit` for every
multi-transaction window, single `verifyAndEmit` for one-off claims, the read-only `verify`
overload so the dashboard can show a verdict before anyone pays for it, `calculateTxIndex` for
every position, the ChainInfo Precompile at `0x0FD3` for boot assertions and the attested head,
`EvmV1Decoder` for receipts and logs, and the Proof Builder reached through `@gluwa/usc-sdk`.
Proofs are built with `usc-sdk`; the Solidity side imports `@gluwa/asc-contracts`.

Just as important is what the protocol declines to assert. There are no state proofs, only
transactions and receipts, so solvency is never read as a balance. It is replayed forward from
an anchor as a running accumulator over proven events, which is exactly why a stream can have a
gap, why gaps are challengeable, and why half the design exists at all. Verification also does
not check whether a transaction succeeded, so every path asserts receipt status for itself.
Batch order carries no guarantee, so the contract sorts and re-derives every index rather than
believing the one it was handed. Gas estimation against precompiles is unreliable, so
submissions use the SDK's own `computeGasLimit`.

One more protocol property does real work. The number of continuity roots in a proof is what
the chain actually charges gas for, so it is a measurement of freshness that no clock provides
and no submitter can game. Watchtower reads its entire prosecutor bounty schedule off that one
number, which means the incentive curve and the chain's cost curve can never drift apart.

## What it proves today

Four rules, one engine. `IntraBlockExtraction` proves a searcher bracketed a victim's swap at
three consecutive indices in one block and settles instantly, because the three proofs are the
entire claim. `ReserveConservation` proves a custodian minted more than it locked, and settles
optimistically behind a bond, because completeness cannot be proven on-chain. `ChainlinkFeed`
is a source rule that never pays anyone; it imports the price Chainlink itself published on
Ethereum so every dollar figure in the system came off a chain rather than out of a backend.
`FailedTx` reimburses gas burned by a reverted transaction.

A rule is a pure `view` function reached by `STATICCALL`, so it cannot write state or move
money, and its worst case is bounded by the subject's per-block payout cap. Adding a fifth risk
means writing one function; the engine, the vault, the proven feed, the bounty schedule and the
fraud-proof machinery all come for free.

The fraud proof is worth calling out, because it runs on Watchtower itself. Proving a
prosecutor skipped a transaction is an ordinary single-transaction submission through the same
entrypoint as every other piece of evidence, verified by the same precompile. It rolls the
accumulator back and takes their bond.

## Live

Creditcoin CC3 Testnet, chain id 102031, reading Ethereum Mainnet at chainKey 3 and Sepolia at
chainKey 1. Mainnet being readable from a testnet deployment is what lets Watchtower prosecute
real, historical Ethereum sandwiches rather than staged ones.

`WatchtowerCore` is at `0x886498645c18a787f6283c25012771d77b068DF2`, `SubjectRegistry` at
`0x063f5167Fe6F65c5B8c9F81862fE92678f248178`, and `UnderwritingVault` at
`0x5c9F0cF5D0057556B1A12D8f4028253c1f1C5A14`. `DemoBridge`, the staged custodian, is on Sepolia
at `0x4044D34f8DF534B364B5EA337b72DD508198A5eF`.

The reference prosecution is linked above. Ethereum Mainnet block 25,955,190, indices 29, 30 and
31 on a UniV2 DAI/WETH pool: a searcher took 0.001467 WETH out of a stranger's execution price.
All three positions were proven through the precompile in one batch call, damages were priced at
3.77 US dollars from the ETH/USD answer Chainlink published, and the whole prosecution cost
1,233,005 gas, which is 1.64 percent of one Creditcoin block. Restitution was zero, and that is
the system working: the victim never bought cover, so the verdict stands on its own and the
incident page says so rather than showing a payout that did not happen.

## Quick start

```bash
pnpm install
cp .env.example .env         # see /docs/environment

cd contracts && forge test   # 79 tests, no network needed
cd .. && pnpm verify         # build, test, typecheck

pnpm worker                  # prosecutor + API on :8080
pnpm web                     # dashboard on :3000
```

Every page renders with no wallet connected. Only spending needs one.

Deploying is two steps in a fixed order, written up at `/docs/deploy`. Every command and when to
reach for it is at `/docs/scripts`.

Three commands keep the Creditcoin integration honest against the live chain rather than against
documentation, which matters because the precompile is native code and a forked node does not
have it. `pnpm verify:precompile` checks that `0x0FD2` derives indices the same way the test
mock does, across 0 to 4095. `pnpm thesis` requires the SDK, the precompile and Etherscan to
agree on three positions. `pnpm capture` freezes a real proof bundle into `fixtures/`, which the
test suite then replays offline.

## Repository

```
contracts/           Foundry. The USC, the rule library, the vault. 79 tests.
packages/shared/     Chain config, rule ids, types, generated ABIs.
packages/attestcoin/ Every conversation with the protocol: SDK client, proofs, pre-flight, gas.
apps/prosecutor/     The worker: scanners, submission path, indexer, REST + SSE.
apps/web/            Next.js. Landing page, application, and /docs.
fixtures/            Proof bundles captured from testnet, replayed by the test suite.
```

The worker is completely untrusted. It finds candidates, waits for attestation, builds proofs
and pays gas, and it cannot forge a verdict, because the precompile re-verifies everything
inside the settling transaction. A lying worker gets a revert and burns its own gas doing it.
The frontend is untrusted too: every number that decides money is read from Creditcoin directly,
and if the worker and the chain disagree, the chain wins.

## Licence

MIT.
