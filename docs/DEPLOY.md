# Deploying

Two deployments, in this order, with an `.env` edit between them. Everything runs from `contracts/`.

```
Sepolia  →  paste 3 values  →  Creditcoin  →  paste 7 values  →  NEXT_PUBLIC copies  →  seed
```

Sepolia has to go first because `DeployCreditcoin` reads the bridge address and its deployment
height, and the Creditcoin deployment has to happen before seeding because `SeedDemo` stakes into
subjects that do not exist yet.

## Before you start

```bash
cd contracts
forge test          # 66 tests, no network
pnpm balances       # from the repo root - all three keys funded
```

`contracts/.env` is a symlink to the repo-root `.env`. Foundry loads `.env` from the **current
directory**, not the project root, so without it `vm.envUint("DEPLOYER_PK")` fails even though the
file plainly exists one level up. `foundry.toml` also defines named endpoints, so `--rpc-url sepolia`
works without your shell having sourced anything — which matters in fish, where `$SEPOLIA_RPC` is
empty.

## 1 — Sepolia: the custodian

```bash
forge script script/DeploySepolia.s.sol --rpc-url sepolia --broadcast
```

Signs with `SEPOLIA_DEMO_PK`. Deploys `DemoBridge`, which deploys its own `DemoToken`, then locks
0.01 ETH so the reserve ledger starts with real collateral behind it.

Prints three values. Put them in `.env`:

```bash
DEMO_BRIDGE_SEPOLIA=0x…      # the custodian ReserveConservation watches
DEMO_TOKEN_SEPOLIA=0x…       # informational - no rule reads it
BRIDGE_ANCHOR_HEIGHT=…       # the deployment block; the stream starts here
```

`BRIDGE_ANCHOR_HEIGHT` is what makes the reserve stream well-defined: nothing before it is ever
expected, so the first ingestion is not a gap.

Also set, if you have not already:

```bash
DEMO_FAILED_TX_WATCH=0x4741BEC65e687F15d5b7E28bbc3F289d29C253f4   # your SEPOLIA_DEMO_PK address
```

## 2 — Creditcoin: the engine

Needs `DEMO_POOL_MAINNET`, `DEMO_AGGREGATOR_MAINNET`, `FEED_ANCHOR_HEIGHT`, `DEMO_BRIDGE_SEPOLIA`,
`BRIDGE_ANCHOR_HEIGHT` and `DEMO_FAILED_TX_WATCH` — all set by now. Refresh the feed anchor first, so
the price scanner does not have to sweep thousands of blocks on its first tick:

```bash
echo $(( $(cast block-number --rpc-url mainnet) - 500 ))     # -> FEED_ANCHOR_HEIGHT

forge script script/DeployCreditcoin.s.sol --rpc-url creditcoin --broadcast
```

Signs with `DEPLOYER_PK`. Deploys the registry, the vault and the core, then the four rules, then
registers the four subjects and links each priced subject to the feed subject.

Prints eleven values. The four `RULE_*` are informational — the core resolves rules through the
registry at call time. The four `SUBJECT_*` hashes are **required**: the worker files evidence against
them and `SeedDemo` stakes to them.

```bash
SUBJECT_REGISTRY=0x…     RULE_INTRABLOCK=0x…    SUBJECT_FEED=0x…
UNDERWRITING_VAULT=0x…   RULE_RESERVE=0x…       SUBJECT_POOL=0x…
WATCHTOWER_CORE=0x…      RULE_FEED=0x…          SUBJECT_BRIDGE=0x…
                         RULE_FAILEDTX=0x…      SUBJECT_ACCOUNT=0x…
```

Then the browser copies — Next.js only exposes variables prefixed `NEXT_PUBLIC_`, and these are public
contract addresses, not secrets:

```bash
NEXT_PUBLIC_WATCHTOWER_CORE=$WATCHTOWER_CORE
NEXT_PUBLIC_SUBJECT_REGISTRY=$SUBJECT_REGISTRY
NEXT_PUBLIC_UNDERWRITING_VAULT=$UNDERWRITING_VAULT
```

## 3 — Seed

```bash
forge script script/SeedDemo.s.sol --rpc-url creditcoin --broadcast
```

Stakes 7 CTC across the three tranches, funds 1.25 CTC of bounty pools, and buys cover so a verdict
has somewhere to pay. Scale it with `SEED_SCALE_BPS` (10000 = full); the script checks the deployer's
balance before broadcasting rather than failing partway through nine transactions.

## Verify

```bash
# subjects registered, read straight off the chain
cast call $SUBJECT_REGISTRY "subjectCount()(uint256)" --rpc-url creditcoin     # -> 4

# the vault holds the seed
cast balance $UNDERWRITING_VAULT --rpc-url creditcoin --ether

# the worker asserts its own assumptions and refuses to start if they fail
pnpm worker
pnpm web
```

## Re-running

The scripts are **not** idempotent. `registerSubject` reverts with `SubjectExists` on a repeat, since
a subject id is `keccak256(chainKey, sourceContract, ruleId)` and those inputs have not changed. To
redeploy cleanly, run `DeployCreditcoin` again — it deploys fresh contracts with a fresh registry —
and replace every address in `.env`. A partial re-run against an existing registry will not work.

`DeploySepolia` is safe to repeat: it deploys a new bridge each time. Update
`DEMO_BRIDGE_SEPOLIA` and `BRIDGE_ANCHOR_HEIGHT`, and redeploy Creditcoin too, because the bridge
subject id is derived from the bridge address.

## Costs

Creditcoin gas is negligible — the whole deployment is a fraction of a CTC. The real spend is
`SeedDemo`'s 8.30 CTC, which is capital you own inside the vault, not a fee. On Sepolia the bridge
deployment plus the 0.01 ETH anchoring lock is the only outlay.
