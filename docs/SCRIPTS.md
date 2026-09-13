# Watchtower scripts: what each one is for

Run everything from the repo root, the folder holding `package.json`.

---

## Demo day

| Command | What it does |
|---|---|
| **`pnpm stage:sandwich`** | **The one you want.** Finds a real sandwich, throws away the ones the system cannot judge, registers the pool, and prints a link that opens the app with everything already filled in. |
| `pnpm stage:sandwich --dry-run` | Same scan, registers nothing. Use it to look before you commit. |
| `pnpm find:sandwich` | Just looks. Reports sandwiches and stops. Use it when you want to see what is out there without changing anything. |
| `pnpm balances` | Checks all three keys have money. Run this first if anything fails. |

**The difference between the two sandwich commands:** `find` tells you what happened. `stage` makes it
prosecutable. If you are about to demo, use `stage`.

---

## Setting things up

| Command | What it does |
|---|---|
| `pnpm watch <address>` | Puts Watchtower on any contract by hand. `stage:sandwich` calls this for you, so you rarely need it directly. Use it for a bridge or an account rather than a pool. |
| `pnpm demo:skip-gap` | Stages the "catch a cheating prosecutor" beat. Submits a deliberately incomplete claim and prints the transaction it skipped, so you can paste that into the Challenge panel and roll it back. |

---

## Running it

| Command | What it does |
|---|---|
| `pnpm worker` | Starts the prosecutor on your own machine. Not needed for the demo, the hosted one is already running. |
| `pnpm web` | Starts the site locally on port 3000. |

---

## Checking it works

| Command | What it does |
|---|---|
| `pnpm verify` | Builds the contracts, runs all 79 tests, typechecks everything. The full health check. |
| `pnpm verify:precompile` | Asks the live Creditcoin precompile to prove a real Ethereum transaction. Confirms the integration itself is alive. |
| `pnpm thesis <tx> <tx> <tx>` | Walks through one sandwich and shows the proof being built, step by step. Good for explaining how it works. |
| `pnpm typecheck` | Types only. Fast. |
| `pnpm test:contracts` | Contract tests only. No network needed. |

---

## Rarely, and only once

| Command | What it does |
|---|---|
| `pnpm deploy:creditcoin` | Deploys the contracts. Already done. Running it again makes a second, separate deployment. |
| `pnpm seed` | Puts the starting money into the vault. Already done. |
| `pnpm capture <tx> <tx> <tx>` | Freezes a real proof into `fixtures/` so the test suite can replay it offline. |
| `pnpm abis` | Regenerates the contract interfaces the website uses. Only after changing a contract. |

---

## If you only remember three

```bash
pnpm balances          # is everything funded
pnpm stage:sandwich    # get a prosecutable sandwich, ready to paste
pnpm verify            # is anything broken
```
