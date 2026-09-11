# Demo runbook

Four minutes, one screen, no scene changes.

## The constraint that shapes everything

**Attestation takes about eight minutes end to end** — not the ~2-minute attestation cadence. Every
live beat must act on evidence that is *already attested*. Stage Sepolia incidents at **T-20 min**,
never on stage.

## T-60: seed

```bash
pnpm seed        # stake, cover, bounties - idempotent, tops up to the target
pnpm worker      # scanners + API
pnpm web         # dashboard
```

`pnpm seed`, not `forge script`: Creditcoin's RPC omits `mixHash`, so forge cannot follow its own
broadcast and can leave a half-finished run behind. See `docs/DEPLOY.md` §2.

Let the feed scanner ingest a Chainlink round and the stream scanner ingest a few `Locked` events, so
the proven-head badge and the ETH/USD tile are live before anyone looks at the screen.

## T-20: stage the live incidents

```bash
cast send $DEMO_BRIDGE_SEPOLIA "lock()" --value 0.01ether --rpc-url $SEPOLIA_RPC --private-key $SEPOLIA_DEMO_PK
cast send $DEMO_BRIDGE_SEPOLIA "mintUnbacked(address,uint256)" $HOLDER 20000000000000000 --rpc-url $SEPOLIA_RPC --private-key $SEPOLIA_DEMO_PK
cast send $DEMO_BRIDGE_SEPOLIA "alwaysReverts()" --rpc-url $SEPOLIA_RPC --private-key $SEPOLIA_DEMO_PK --gas-limit 100000
```

### Find a sandwich that actually exists

Which pools are being sandwiched changes week to week. The canonical UniV2 USDC/WETH pair goes
thousands of blocks without one — that flow moved to V3 — so do not assume, scan:

```bash
pnpm find:sandwich --span 150        # every UniV2-style pool, recent blocks
```

It prints transaction triples with the pool, the attacker, the victim and the extracted amount, and
flags any window the deployed rule cannot price (the instance is configured for the 18-decimal side of
the pair; see `IntraBlockExtraction.PRICED_SIDE_IS_TOKEN0`). Register the pool it found:

```bash
pnpm watch 0xPOOL --label "UniV2 DAI/WETH" --bounty 0.25 --stake 1
```

That registers the subject, links it to the proven ETH/USD feed, stakes and funds the bounty — the
same command that serves beat 6. Then warm the proof so it returns from cache on stage:

```bash
pnpm thesis 0xFRONTRUN 0xVICTIM 0xBACKRUN
```

The Proof Builder caches, so a warmed bundle comes back with `cached: true` in seconds instead of
being rebuilt while the room watches.

Then dry-run the gap-challenge beat, which needs **two** custodian transactions sitting after the
proven cursor — the `lock()` above is the one it will skip, the `mintUnbacked` the one it files:

```bash
pnpm demo:skip-gap
```

It prints the skipped transaction hash. Keep it on the clipboard for beat 4.

## T-5: health check

`/api/health` must show: `ok: true` · prosecutor balance > 2 CTC · every RPC green · attested heads
advancing · `cursorLag` under ~50 blocks per stream subject · SSE connected · vault funded. And every
staged transaction must already be attested — if one is not, drop that beat rather than waiting on
stage.

```bash
curl -s localhost:8080/api/health | jq '{ok, prosecutorBalanceCtc, attestedHeads, cursorLag, rpcStatus}'
```

`cursorLag` is the number that separates "nothing has happened lately" from "the prosecutor stopped
working an hour ago" — two states that look identical on a dashboard showing only the latest verdict.

## The run

| Time | Beat | Action | Fallback |
|---|---|---|---|
| 0:00 | **Cold open** | Nothing. The dashboard is already alive: proven head ticking, ETH/USD proven from Chainlink's own transaction. | — |
| 0:25 | **A real sandwich** | Paste the pre-warmed **mainnet** tx hashes → Prosecute. Three adjacent cells light; the verdict names the real attacker, victim and pool, with damages in dollars at the price Chainlink itself published. Say the payout line out loud — see below. | A second warmed triple; last resort, open the settled incident already in the feed. |
| 1:25 | **A custodian goes insolvent** | The staged over-mint is already attested — the stream scanner ingests it and the reserve tile flips red, opening a bonded breach. | Pre-staged breach already open. |
| 2:05 | **Attack your own system** | `pnpm demo:skip-gap` submits a stream step that steps over the staged `Locked` and prints the hash it skipped. Paste that into the incident's Challenge panel. Bond slashed, accumulator rolled back, live in the same feed. | Run `forge test --match-path test/unit/GapChallenge.t.sol -vv` on screen and narrate. |
| 2:45 | **A new risk in sixty lines** | Prosecute the staged reverted transaction. *"Same engine, same vault, same feed — this rule is sixty lines long."* | Show `FailedTx.sol`; it is short enough to read aloud. |
| 3:10 | **Open the market** | Take a contract address from the room: `pnpm watch 0xADDR --label "…"` registers it and funds the bounty in one command, and it appears on the dashboard within one poll. | Use a prepared address, or fund an existing subject from the Fund-a-watch panel. |
| 3:35 | **Close** | Writability: verdicts become enforceable messages back on Ethereum — restitution, not reimbursement. | — |

Beat 4 is the one nobody else will do: demonstrating an attack on your own protocol *and its defence*,
using the same protocol, on stage.

## Lines worth saying exactly

- *"An Ethereum contract cannot see the transactions beside it in its own block. A Creditcoin contract
  can. That is the entire product."*
- *"$34.00 — at the price Chainlink itself published in block 21,340,118, proven by the precompile,
  not reported by us."*
- *"You cannot prove a negative on-chain, so we do not pretend to. Solvency claims are bonded and
  challengeable. Here is the challenge working."*
- *"This rule is sixty lines. The engine is the product; the rules are the catalogue."*
- On the mainnet sandwich paying nothing — say it before anyone asks:
  *"Restitution is zero, and that is the system working. The victim is a real stranger on mainnet who
  never bought cover. The verdict still stands, the prosecutor still got paid for proving it.
  Insurance pays the insured."*
- *"That prosecution cost 1.64 % of one Creditcoin block. Three Ethereum transactions verified, three
  indices derived by the precompile, a rule evaluated and the vault moved."*

## If something breaks

- **Proof builder slow** → the warmed proof returns `cached: true`; say so, it is a feature.
- **A live beat is not attested yet** → skip it, open a settled incident instead, and explain the
  eight-minute floor as a property of decentralised attestation rather than an apology.
- **Worker out of CTC** → the header badge goes red before anything fails. Top it up at T-5.
- **The sandwich you warmed is stale by showtime** → `pnpm find:sandwich` again and `pnpm watch` the
  new pool; registering takes two transactions and a few seconds.
- **A verdict shows damages but zero paid** → expected on a real mainnet victim. Use the line above.
