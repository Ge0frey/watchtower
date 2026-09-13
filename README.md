# Watchtower

**Proof-native insurance for Ethereum, underwritten on Creditcoin.**

Watchtower pays out when Ethereum costs you money, and it never takes your word for it. Every claim is
a cryptographic proof of an Ethereum transaction, verified on Creditcoin by the Attestcoin Protocol's
Block Prover Precompile, priced and settled in a single block. No claims adjuster, no oracle operator,
no multisig, no trusted watcher.

Built for BUIDL CTC 2026 Fall. DeFi track (primary). RWA track (secondary)

## The one idea

An Ethereum contract cannot see the transactions beside it in its own block. The Attestcoin Protocol's
precompile verifies any Ethereum transaction and exposes `calculateTxIndex`, the transaction's position
inside its block. That is enough for a Creditcoin contract to prove statements about Ethereum's
execution order.

> A Creditcoin contract can see what an Ethereum contract cannot: its neighbours.

## What it proves today

| Rule | Claim | Window | Settlement |
|---|---|---|---|
| `IntraBlockExtraction` | A searcher bracketed a victim's swap | 3 adjacent | instant |
| `ReserveConservation` | A custodian minted more than it locked | stream, max 10 | optimistic, challengeable |
| `ChainlinkFeed` | The price Chainlink itself published | stream, max 10 | source rule |
| `FailedTx` | A transaction reverted and burned gas for nothing | 1 | instant |

Four rules, one engine. Adding a fifth risk means writing one pure function.

## Documentation

The full documentation is a route in the application:
**[/docs](https://watchtower-attestation.vercel.app/docs)**. Run `pnpm web` and open it locally, or
read it on the deployed site.

[Quickstart](https://watchtower-attestation.vercel.app/docs/quickstart) ·
[The whole flow](https://watchtower-attestation.vercel.app/docs/end-to-end) ·
[Architecture](https://watchtower-attestation.vercel.app/docs/architecture) ·
[Attestcoin Protocol](https://watchtower-attestation.vercel.app/docs/attestcoin) ·
[Environment](https://watchtower-attestation.vercel.app/docs/environment) ·
[Scripts](https://watchtower-attestation.vercel.app/docs/scripts) ·
[Limits](https://watchtower-attestation.vercel.app/docs/limits)

## Quick start

```bash
pnpm install
cp .env.example .env         # see /docs/environment

cd contracts && forge test   # 79 tests, no network needed
cd .. && pnpm verify         # build, test, typecheck

pnpm worker                  # prosecutor + API on :8080
pnpm web                     # dashboard on :3000
```

Deploying is two steps in a fixed order, written up at
[/docs/deploy](https://watchtower-attestation.vercel.app/docs/deploy). Every command and when to reach
for it is at [/docs/scripts](https://watchtower-attestation.vercel.app/docs/scripts).

Everything renders with no wallet connected. Only spending needs one.

## Live

Creditcoin CC3 Testnet (chain id 102031), reading Ethereum Mainnet and Sepolia.

| | |
|---|---|
| Dashboard | <https://watchtower-attestation.vercel.app> |
| `WatchtowerCore` | [`0x8864…8DF2`](https://creditcoin-testnet.blockscout.com/address/0x886498645c18a787f6283c25012771d77b068DF2) |
| `SubjectRegistry` | [`0x063f…8178`](https://creditcoin-testnet.blockscout.com/address/0x063f5167Fe6F65c5B8c9F81862fE92678f248178) |
| `UnderwritingVault` | [`0x5c9F…5A14`](https://creditcoin-testnet.blockscout.com/address/0x5c9F0cF5D0057556B1A12D8f4028253c1f1C5A14) |
| `DemoBridge` (Sepolia) | [`0x4044…A5eF`](https://sepolia.etherscan.io/address/0x4044D34f8DF534B364B5EA337b72DD508198A5eF) |

A real Ethereum mainnet sandwich, prosecuted on Creditcoin:
[`0x9cad…9308`](https://creditcoin-testnet.blockscout.com/tx/0x9cad4c89ea95410e08896de3ae35d96a978348a9cc1a082824377f5505d29308).
Three transactions verified in one batch call, damages priced at $3.77 from the ETH/USD answer
Chainlink itself published, settled for 1.64% of one Creditcoin block in gas.

## Repository

```
contracts/           Foundry. The ASC, the rule library, the vault. 79 tests.
packages/shared/     Chain config, rule ids, types, generated ABIs.
packages/attestcoin/ SDK client, proof building, pre-flight, gas.
apps/prosecutor/     The worker: scanners, submission path, indexer, REST + SSE.
apps/web/            Next.js. Landing page, application, and /docs.
fixtures/            Proof bundles captured from testnet, replayed by the test suite.
```

## Licence

MIT.
