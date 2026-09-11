# Filling in `.env`

Twenty-odd values, but only **three** are things you create. The rest are either public addresses you
look up once, or outputs the deploy scripts print for you.

| Group | Values | Where they come from |
|---|---|---|
| **A — you generate** | `DEPLOYER_PK`, `PROSECUTOR_PK`, `SEPOLIA_DEMO_PK` | `cast wallet new`, then fund them |
| **B — you sign up for** | `MAINNET_RPC`, `SEPOLIA_RPC` | Alchemy / Infura free tier |
| **C — public, look up once** | `DEMO_POOL_MAINNET`, `DEMO_AGGREGATOR_MAINNET`, `FEED_ANCHOR_HEIGHT` | already resolved below |
| **D — printed by the deploy scripts** | every contract address, every `SUBJECT_*`, `BRIDGE_ANCHOR_HEIGHT` | copy from script output |
| **E — copies of D** | `NEXT_PUBLIC_*`, `DEMO_FAILED_TX_WATCH` | paste the same values |

Work through them in that order: A → B → C → deploy → D → E.

---

## A. The three private keys

These are **testnet-only throwaway keys**. Generate them yourself; never reuse a key that holds real
funds, and never commit them.

```bash
cast wallet new        # run three times
```

Each run prints an address and a private key. Assign them:

| Variable | Role | Needs funding | Why that much |
|---|---|---|---|
| `DEPLOYER_PK` | deploys the Creditcoin contracts, owns the registry and vault, runs `SeedDemo` | **~10 CTC** (no Sepolia ETH) | deploy gas is small; `SeedDemo` spends **8.30 CTC** — 7 staked, 1.25 into bounty pools, 0.05 in premiums |
| `PROSECUTOR_PK` | the worker's hot key: builds proofs, pays gas, posts bonds | **~2 CTC** | gas per proof is `2.6e-5`–`9.3e-4` CTC; each optimistic breach escrows a **0.1 CTC bond**, returned on settlement and slashed if successfully challenged |
| `SEPOLIA_DEMO_PK` | deploys and operates `DemoBridge` — locks, mints, stages the insolvency | **~0.05 Sepolia ETH** | contract deployment, plus `lock{value: 0.01 ether}` at deploy and the staged incidents |

`DEPLOYER_PK` does **not** need Sepolia ETH — `DeploySepolia.s.sol` signs with `SEPOLIA_DEMO_PK`.

If the faucet gives you less than 10 CTC per request, either request twice for the deployer address or
scale the seed down — every amount in `SeedDemo.s.sol` is proportional to `SEED_SCALE_BPS`:

```bash
SEED_SCALE_BPS=5000 forge script script/SeedDemo.s.sol --rpc-url $CC3_RPC --broadcast   # half
```

The script checks the deployer's balance before broadcasting and tells you to lower the scale rather
than failing halfway through.

You can use one key for all three to get moving, but keep them separate for the demo: the prosecutor
balance is a badge on the dashboard, and it reads better when it is genuinely a third party.

### Funding

- **Creditcoin testnet CTC** — the faucet is a **Discord bot, not a web form**. Join
  <https://discord.gg/creditcoin>, open the `token-faucet` channel, and run
  `/faucet address:<your EVM address>` for each of `DEPLOYER_PK` and `PROSECUTOR_PK`. Wait for
  *"CTC Faucet successful"*; the bot opens a thread with the transaction. Docs:
  <https://docs.creditcoin.org/wallets/using-testnet-faucet>. Verify with:
  ```bash
  cast balance $(cast wallet address --private-key $PROSECUTOR_PK) --rpc-url $CC3_RPC --ether
  ```
- **Sepolia ETH** — any public faucet (Google Cloud Web3, Alchemy, pk910's PoW faucet). Fund
  `DEPLOYER_PK` and `SEPOLIA_DEMO_PK`.

---

## B. RPC endpoints

Free tier is enough; the scanners poll every 12–120 seconds.

```bash
MAINNET_RPC=https://eth-mainnet.g.alchemy.com/v2/<key>
SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/<key>
```

Mainnet is not optional. `chainKey 3` is readable from CC3 Testnet, which is what lets Watchtower
prosecute **real, historical Ethereum sandwiches** in a testnet demo — the single best thing about the
demo. Set the fallbacks too if you have a second provider; the worker fails over.

`CC3_RPC` already has a working default and needs no key.

### The fallbacks

Optional, and they need no signup. The worker races both endpoints and takes the first good answer,
so one provider going down does not stall the scanners.

```bash
MAINNET_RPC_FALLBACK=https://eth.drpc.org
SEPOLIA_RPC_FALLBACK=https://sepolia.gateway.tenderly.co
```

Both were tested against the query shapes the scanners actually issue - address-filtered `eth_getLogs`
and `eth_getBlockByNumber` with full transactions, which is how the sandwich scanner maps a log back
to its sender. Results from that run:

| Endpoint | Verdict |
|---|---|
| `eth.drpc.org` | works, including unfiltered `getLogs` — best mainnet fallback |
| `ethereum-rpc.publicnode.com` | works, but **refuses `getLogs` without an address filter**. Fine for us (every scanner filters by address), so it is a usable second fallback. |
| `sepolia.gateway.tenderly.co` | works fully — best Sepolia fallback |
| `ethereum-sepolia-rpc.publicnode.com` | same address-filter restriction as its mainnet sibling |
| `rpc.ankr.com/eth`, `cloudflare-eth.com`, `eth.llamarpc.com` | all failing |
| `1rpc.io/eth` | live, but returns HTTP 410 on `getLogs` — unusable for a scanner |
| `sepolia.drpc.org`, `rpc.sepolia.org` | failing |

**The better fallback is a second provider account, not a public node.** The point of a fallback is
*decorrelated* failure: if your primary is Alchemy, a free Infura or dRPC key fails independently,
whereas shared public endpoints tend to be rate-limited exactly when everyone else is hammering them
too. Public nodes are the zero-effort option and they are genuinely fine for a demo.

Leave both blank and the worker uses a single endpoint - the transport degrades to a plain HTTP
provider and nothing else changes.

---

## C. Public mainnet addresses — resolved live

These were read from Ethereum mainnet rather than copied from memory:

```bash
# Uniswap V2 USDC/WETH pair (factory.getPair(USDC, WETH))
DEMO_POOL_MAINNET=0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc
#   token0 = USDC (6 decimals)
#   token1 = WETH (18 decimals)

# Chainlink ETH/USD — the AGGREGATOR, not the proxy
DEMO_AGGREGATOR_MAINNET=0x7d4E742018fb52E48b08BE73d041C18B21de6Fb5
```

**Why the aggregator and not the proxy.** `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` is the ETH/USD
proxy everyone quotes, and it emits nothing — `AnswerUpdated` comes from the aggregator behind it.
Point the feed subject at the proxy and the price tile stays empty forever.

**The aggregator address changes** when Chainlink upgrades the feed, so re-read it rather than
trusting this file:

```bash
cast call 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 "aggregator()(address)" --rpc-url $MAINNET_RPC
```

**A consequence worth knowing.** token0 on that pair is USDC at 6 decimals; the ETH/USD feed prices
WETH. `IntraBlockExtraction` is therefore deployed with `tokenDecimals = 18` and
`pricedSideIsToken0 = false`, and it declines to put a number on a sandwich the searcher funded with
USDC rather than publishing a figure that is wrong by twelve orders of magnitude. Covering that
direction means a second instance with the USDC-side configuration — see
`test_declinesSandwichOnTheUnpricedSide`.

### `FEED_ANCHOR_HEIGHT`

Where the price stream starts. A few hundred blocks back from the current head, so the first tick has
a round to find:

```bash
echo $(( $(cast block-number --rpc-url $MAINNET_RPC) - 500 ))
```

Do not set it far back: every intervening block widens the first scan.

---

## D. Deploy, then copy the output

### Sepolia first — the custodian

```bash
forge script script/DeploySepolia.s.sol --rpc-url $SEPOLIA_RPC --broadcast
```

Prints `DEMO_BRIDGE_SEPOLIA`, `DEMO_TOKEN_SEPOLIA` and `BRIDGE_ANCHOR_HEIGHT` (the deployment block —
the reserve stream starts there, so nothing before it is ever expected).

`DEMO_TOKEN_SEPOLIA` is informational; no rule reads it. The bridge deploys its own token and the
address is printed so you can watch balances during the demo.

### Then Creditcoin

`DeployCreditcoin.s.sol` reads `DEMO_POOL_MAINNET`, `DEMO_AGGREGATOR_MAINNET`, `DEMO_BRIDGE_SEPOLIA`,
`DEMO_FAILED_TX_WATCH`, `FEED_ANCHOR_HEIGHT` and `BRIDGE_ANCHOR_HEIGHT` — fill those in first.

```bash
forge script script/DeployCreditcoin.s.sol --rpc-url $CC3_RPC --broadcast
```

Prints, ready to paste:

```
SUBJECT_REGISTRY=0x…      RULE_INTRABLOCK=0x…     SUBJECT_FEED=0x…
UNDERWRITING_VAULT=0x…    RULE_RESERVE=0x…        SUBJECT_POOL=0x…
WATCHTOWER_CORE=0x…       RULE_FEED=0x…           SUBJECT_BRIDGE=0x…
                          RULE_FAILEDTX=0x…       SUBJECT_ACCOUNT=0x…
```

The four `RULE_*` addresses are informational — the core finds rules through the registry at call
time, so nothing breaks if you leave them blank. The four `SUBJECT_*` hashes are **not** optional:
the worker files evidence against them and `SeedDemo.s.sol` stakes to them. They are
`keccak256(abi.encode(chainKey, sourceContract, ruleId))`, so they are deterministic — but copy them
from the output rather than recomputing.

---

## E. The copies

```bash
# Whose failed transactions are covered. Use the Sepolia demo address so you can stage a revert
# with DemoBridge.alwaysReverts() during the demo:
DEMO_FAILED_TX_WATCH=$(cast wallet address --private-key $SEPOLIA_DEMO_PK)

# The browser cannot read server-side variables - these must be duplicated with the NEXT_PUBLIC_
# prefix, and they are just copies:
NEXT_PUBLIC_WATCHTOWER_CORE=$WATCHTOWER_CORE
NEXT_PUBLIC_SUBJECT_REGISTRY=$SUBJECT_REGISTRY
NEXT_PUBLIC_UNDERWRITING_VAULT=$UNDERWRITING_VAULT
NEXT_PUBLIC_WORKER_API_URL=http://localhost:8080
```

These three are public contract addresses, not secrets. Restart `pnpm web` after setting them —
Next.js inlines `NEXT_PUBLIC_*` at build time.

---

## Check it worked

```bash
# 1. the integration, against the live chain
pnpm --filter @watchtower/attestcoin verify:precompile

# 2. keys funded
cast balance $(cast wallet address --private-key $PROSECUTOR_PK) --rpc-url $CC3_RPC --ether

# 3. the worker asserts its own assumptions and refuses to start if they fail
pnpm worker
#   creditcoin      chainId 102031
#   attestcoin      chainKey 1 -> Sepolia, chainKey 3 -> Mainnet
#   prosecutor      0x…  4.2 CTC

# 4. seed capital, cover and bounties
forge script script/SeedDemo.s.sol --rpc-url $CC3_RPC --broadcast

# 5. the thesis, against a real mainnet sandwich
pnpm thesis 0xFRONTRUN 0xVICTIM 0xBACKRUN
```

## Minimum set to see something work

Skip the demo staging and run read-only: `MAINNET_RPC`, `SEPOLIA_RPC`, `DEPLOYER_PK` (funded with
CTC), `DEMO_POOL_MAINNET`, `DEMO_AGGREGATOR_MAINNET`, `FEED_ANCHOR_HEIGHT`. Deploy to Creditcoin with
a placeholder bridge address, set `SUBMIT_ENABLED=false`, and the dashboard renders live registry
state with no prosecutor key at all.
