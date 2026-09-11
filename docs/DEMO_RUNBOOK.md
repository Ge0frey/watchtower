# Demo runbook

Four minutes, one screen, no scene changes.

## The constraint that shapes everything

**Attestation takes about eight minutes end to end** — not the ~2-minute attestation cadence. Every
live beat must act on evidence that is *already attested*. Stage Sepolia incidents at **T-20 min**,
never on stage.

## T-60: seed

```bash
forge script script/SeedDemo.s.sol --rpc-url $CC3_RPC --broadcast   # stake, cover, bounties
pnpm worker                                                          # scanners + API
pnpm web                                                             # dashboard
```

Let the feed scanner ingest a Chainlink round and the stream scanner ingest a few `Locked` events, so
the proven-head badge and the ETH/USD tile are live before anyone looks at the screen.

## T-20: stage the live incidents

```bash
cast send $DEMO_BRIDGE_SEPOLIA "lock()" --value 0.01ether --rpc-url $SEPOLIA_RPC --private-key $SEPOLIA_DEMO_PK
cast send $DEMO_BRIDGE_SEPOLIA "mintUnbacked(address,uint256)" $HOLDER 20000000000000000 --rpc-url $SEPOLIA_RPC --private-key $SEPOLIA_DEMO_PK
cast send $DEMO_BRIDGE_SEPOLIA "alwaysReverts()" --rpc-url $SEPOLIA_RPC --private-key $SEPOLIA_DEMO_PK --gas-limit 100000
```

Also warm the mainnet sandwich proof so it returns from cache on stage:

```bash
pnpm thesis 0xFRONTRUN 0xVICTIM 0xBACKRUN
```

## T-5: health check

`/api/health` must show: prosecutor balance > 2 CTC · every RPC green · attested heads advancing ·
SSE connected · vault funded. And every staged transaction must already be attested — if one is not,
drop that beat rather than waiting on stage.

## The run

| Time | Beat | Action | Fallback |
|---|---|---|---|
| 0:00 | **Cold open** | Nothing. The dashboard is already alive: proven head ticking, ETH/USD proven from Chainlink's own transaction. | — |
| 0:25 | **A real sandwich** | Paste the pre-warmed **mainnet** tx hashes → Prosecute. Three adjacent cells light; the verdict names the real attacker, victim and pool, with damages in dollars. | A second warmed hash; last resort, open the settled incident already in the feed. |
| 1:25 | **A custodian goes insolvent** | The staged over-mint is already attested — the stream scanner ingests it and the reserve tile flips red, opening a bonded breach. | Pre-staged breach already open. |
| 2:05 | **Attack your own system** | Submit a stream step that skips the `Locked` event, then challenge it. Bond slashed, accumulator rolled back, live in the same feed. | Run `forge test --match-path test/unit/GapChallenge.t.sol -vv` on screen and narrate. |
| 2:45 | **A new risk in sixty lines** | Prosecute the staged reverted transaction. *"Same engine, same vault, same feed — this rule is sixty lines long."* | Show `FailedTx.sol`; it is short enough to read aloud. |
| 3:10 | **Open the market** | Take a contract address from the room and fund a watch on it. The leaderboard updates. | Use a prepared address. |
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

## If something breaks

- **Proof builder slow** → the warmed proof returns `cached: true`; say so, it is a feature.
- **A live beat is not attested yet** → skip it, open a settled incident instead, and explain the
  eight-minute floor as a property of decentralised attestation rather than an apology.
- **Worker out of CTC** → the header badge goes red before anything fails. Top it up at T-5.
