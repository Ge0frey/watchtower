# Attestcoin Protocol Integration

How Watchtower uses the Attestcoin Protocol, mapped claim by claim to the documentation and to the
source file that implements it.

**Environment:** Creditcoin CC3 Testnet · chain id **102031** (`0x18e8f`, read from the live RPC) ·
source chains Ethereum Sepolia (`chainKey 1`) and Ethereum Mainnet (`chainKey 3`).

---

## 1. What Watchtower needs from the protocol, and why

Watchtower settles two claims Ethereum cannot check about itself:

1. **A searcher bracketed a victim's swap** — front-run, victim, back-run at *consecutive positions
   inside one Ethereum block*. An Ethereum contract cannot see the transactions beside it, so this
   fact is unreachable from the source chain.
2. **A custodian minted more than it locked** — a running balance sheet rebuilt from a proven,
   gap-checked event stream.

Both reduce to one coordinate: **`(chainKey, blockHeight, txIndex)`**. The protocol supplies all
three, and the third one — position inside the block — is the reason the product exists.

## 2. Protocol surfaces used

| Surface | Where we use it | Source |
|---|---|---|
| Block Prover Precompile `0x0FD2` — **batch** `verifyAndEmit(uint64, uint64[], bytes[], MerkleProof[], ContinuityProof)` | Every submission. One call, one continuity proof shared by the whole window. | `contracts/src/core/WatchtowerCore.sol` → `_verifyAndBuild` |
| Precompile — single `verifyAndEmit(...)` | Single-transaction windows (`FailedTx`, gap challenges) | same |
| Precompile — read-only `verify(...)` overloads | `previewEvidence()` so the dashboard can show a verdict with no gas, and the worker's pre-flight | `WatchtowerCore.previewEvidence`, `packages/attestcoin/src/preflight.ts` |
| Precompile — **`calculateTxIndex(MerkleProof)`** | The project's thesis. Every transaction's position comes from the protocol, never from our arithmetic. | `WatchtowerCore._buildWindow` |
| `TransactionVerified` event | Free third-party corroboration on the explorer for every verdict | emitted by `verifyAndEmit` |
| `EvmV1Decoder` (`@gluwa/asc-contracts`) | Receipt status, `from`/`to`, gas used, log filtering by event signature, type-specific gas price | `WatchtowerCore`, all four rules |
| `NativeQueryVerifierLib` | `getVerifier()`, and `hasPrecompile()` / `isCreditcoinChainId()` for environment guards | `WatchtowerCore` constructor |
| ChainInfo Precompile `0x0FD3` (via SDK) | Boot assertion on the chainKey mapping; the dashboard's attested-head badge | `packages/attestcoin/src/client.ts` |
| Proof Builder service (via SDK) | `waitUntilHeightAttested`, `getProof`, `getBatchProof` | `packages/attestcoin/src/proofs.ts` |
| SDK `utils.gas.computeGasLimit` | Gas limits on every submission | `packages/attestcoin/src/gas.ts` |

Everything except writability, which is still in third-party audit and is deliberately kept off the
critical path. Section 8 describes what it unlocks.

## 3. The readability round trip, end to end

```
Ethereum                     Prosecutor worker                    Creditcoin
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
   │                                │◄─────────────── VerdictIssued ───┤
```

Steps 1–5 are the protocol's documented readability flow; steps 6–10 are Watchtower's business logic.
Nothing between them is trusted: the worker only assembles proofs and pays gas.

## 4. Design decisions the protocol forced

**No state proofs, so the balance sheet is replayed.** The protocol proves transactions and receipts,
not account state. `ReserveConservation` therefore accumulates `Locked`/`Unlocked`/`Minted`/`Burned`
from an anchor, and the cursor `(blockHeight, txIndex)` is what makes the replay ordered and
inspectable. — *docs: Step 2, Data Extraction Phase.*

**The precompile does not check success, so we do — except once, deliberately.** Every path asserts
`receiptStatus == 1`. `FailedTx` is the single rule that asserts `== 0`, and that inversion lives in
the rule, never in the core. — *docs: Architecture, Block Prover Precompile.*

**The replay guard is rule-scoped, unlike the reference ASC.** `ASCBase` dedupes on
`keccak(chainKey, height, txIndex)`. Watchtower cannot: one Ethereum transaction is legitimately
evidence under several rules — a bridge `Locked` transaction feeds the reserve accumulator, and the
same transaction may later prove that the accumulator skipped it. We key on
`keccak(ruleId, subjectId, chainKey, height, index)`. — `libs/SubjectKey.sol`.

**Ten transactions, 1000 blocks.** `WatchtowerCore._checkShape` rejects larger windows, and the stream
scanner chunks to match. — *docs: Oracle Capacity; SDK `MAX_BATCH_SIZE`.*

**Batch order is not guaranteed.** `getBatchProof` returns `Map<blockHeight, Map<txIndex, entry>>`, and
map iteration order carries no promise. The worker sorts before submitting; the contract sorts again
and re-derives every index from the precompile, so a dishonest ordering cannot survive.

**Gas estimation fails against precompiles.** `pallet-evm` does not reliably propagate revert reasons
in estimation mode, so we use the SDK's `computeGasLimit`, which falls back to
`21000 + continuityLength × 5000 + 20000`. Never raw `estimateGas`.

**Attestation is ~8 minutes end to end**, not the ~2-minute attestation cadence. The official example
waits with `(15_000, 1_200_000)` and says so; we use the same values and narrate the wait in the UI
rather than hiding it behind a spinner.

## 5. Continuity length is our pricing signal

The number of continuity roots in a proof is exactly what the chain charges gas for: evidence near a
live attestation needs ~10 hashes; past the 24-hour checkpoint cliff it needs ~1000 and costs roughly
ten times as much.

Watchtower reads freshness off the proof itself rather than off a clock:

| Continuity roots | Bounty multiplier | What it means |
|---|---|---|
| ≤ 100 | 1.00× | near a live attestation |
| ≤ 900 | 0.50× | aging |
| > 900 | 0.20× + gas | past the checkpoint cliff |

No oracle, no timestamp, nothing to game — the prosecutor's incentive is derived from the protocol's
own cost curve. — `contracts/src/core/UnderwritingVault.sol`.

## 5.1 What it actually costs, measured

Not from the documentation — from our own receipts on CC3 Testnet. `MAX_GAS_CAP` is 75,000,000, so
the percentage is of one whole Creditcoin block:

| Submission | Continuity roots | Gas used | Share of a block |
|---|---|---|---|
| `IntraBlockExtraction`, **three transactions** in one batch call, one shared continuity proof | 1 | 1,233,005 | **1.64 %** |
| `ChainlinkFeed`, one transaction | 4 | 519,540 | **0.69 %** |
| `ReserveConservation`, one transaction | 50 | 502,390 | **0.67 %** |

The first row is the claim worth quoting: a complete sandwich prosecution — three Ethereum
transactions verified, three indices derived from the precompile, three receipts decoded, a rule
evaluated and the vault moved — costs under two percent of one Creditcoin block. Receipt:
[`0x9cad…9308`](https://creditcoin-testnet.blockscout.com/tx/0x9cad4c89ea95410e08896de3ae35d96a978348a9cc1a082824377f5505d29308).

The worker logs `gasAsPercentageOfMax(receipt.gasUsed)` for every submission, so this table is
reproducible rather than quoted: run the worker and read the `[queue] … settled in …` line.

## 6. Verifying our own assumptions

Three checks in the repository confirm the integration against the live chain rather than against
docs:

**`pnpm verify:precompile`** asks the live precompile at `0x0FD2` to
read back sibling paths built for known indices. It passes for indices 0 … 4095, which is what makes
the offline unit suite trustworthy: `MockBlockProver` derives indices the same way the chain does.

```
Block Prover Precompile 0x0FD2 on chainId 102031
  expected   46   precompile   46   MATCH
  expected   47   precompile   47   MATCH
  expected   48   precompile   48   MATCH
The precompile uses the same convention as MockBlockProver.
```

**`pnpm thesis <front> <victim> <back>`** runs the Day-1 assertion against a real Ethereum Mainnet
sandwich: the SDK's `txIndex`, the precompile's `calculateTxIndex`, and the true Etherscan index must
all agree, and the three-transaction window must verify through the batch overload with one shared
continuity proof.

**`pnpm capture <txHash>…` then `forge test --match-path test/unit/FixtureReplay.t.sol`** freezes a
real proof bundle into `fixtures/` and replays it offline. It asserts that the index derived from the
*real* Merkle sibling path equals the index the Proof Builder reported for that transaction, and that
`EvmV1Decoder` decodes the *real* `encodedTransaction` bytes — real receipts, real logs:

```
replaying fixtures/sepolia-bridge-locked.json
  block 11681051 index 74
  from 0x4741BEC65e687F15d5b7E28bbc3F289d29C253f4
  status 1 logs 1
```

This is the Day-1 thesis committed as a test rather than left in a script's output. Every other suite
uses synthesised transactions, which proves the logic and not the decoding; this one proves the
decoding. It skips, loudly, when no fixture has been captured, so a clone with no API keys still runs
the offline suite green.

The worker also asserts the chainKey mapping at boot and refuses to start if it is wrong:

```
WATCHTOWER prosecutor
  creditcoin      chainId 102031
  attestcoin      chainKey 1 -> Sepolia, chainKey 3 -> Mainnet
```

## 7. Why an offline mock, and why it is honest

Creditcoin's precompile is native Rust in the runtime, not EVM bytecode — `extcodesize` is zero and a
forked anvil node does **not** have it. Unit tests therefore `vm.etch` a stateless `MockBlockProver`
at `0x0FD2`. Section 6's conformance script is what keeps that substitution honest, and
`NativeQueryVerifierLib.hasPrecompile()` is the correct production guard precisely because a naive
code-length check would report the precompile missing.

## 8. Writability, when it ships

Watchtower is architected for it and demos without it. `@gluwa/asc-contracts@0.2.1` already ships the
outbound suite (`Outbox`, `Inbox`, `AttestorRegistry`, `RelayerContract`, `ASCProofVerifier`), so the
path is concrete: a settled verdict publishes a message to the destination chain's Outbox, attestors
sign it, a relayer delivers it to the Inbox, and restitution is enforced **at the source** rather than
reimbursed on Creditcoin. Readability proves the harm; writability undoes it.

## 9. File map

| Concern | File |
|---|---|
| The ASC — the only contract that calls the precompile | `contracts/src/core/WatchtowerCore.sol` |
| Window shapes and ordering | `contracts/src/libs/EvidenceLib.sol` |
| Rule-scoped replay keys | `contracts/src/libs/SubjectKey.sol` |
| Sandwich rule | `contracts/src/rules/IntraBlockExtraction.sol` |
| Custodian solvency rule | `contracts/src/rules/ReserveConservation.sol` |
| Proven price import | `contracts/src/rules/ChainlinkFeed.sol` |
| Failed-transaction rule | `contracts/src/rules/FailedTx.sol` |
| SDK client and boot assertions | `packages/attestcoin/src/client.ts` |
| Proof building and batch flattening | `packages/attestcoin/src/proofs.ts` |
| Read-only pre-flight | `packages/attestcoin/src/preflight.ts` |
| Proof → calldata | `packages/attestcoin/src/encode.ts` |
| Gas limits | `packages/attestcoin/src/gas.ts` |
| Day-1 thesis check | `packages/attestcoin/src/scripts/thesis.ts` |
| Precompile conformance | `packages/attestcoin/src/scripts/verify-precompile.ts` |
| Real-bundle capture | `packages/attestcoin/src/scripts/capture-fixtures.ts` |
| Real-bundle replay, offline | `contracts/test/unit/FixtureReplay.t.sol` |
| Staged gap, for the fraud-proof demo | `packages/attestcoin/src/scripts/demo-skip-gap.ts` |
| Finding a live mainnet sandwich | `scripts/find-sandwich.mjs` |
| Registering and funding a watch on any address | `scripts/watch-address.mjs` |
| Fuzzed invariants | `contracts/test/unit/Invariants.t.sol` |
