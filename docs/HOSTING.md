# Hosting

`docs/DEPLOY.md` puts the contracts on-chain. This puts the application in front of people.

Two units, and they have opposite shapes:

| | What it is | Where | Plan |
|---|---|---|---|
| `apps/web` | Next 15. Every app route is a client component that reads Creditcoin directly. | Vercel | Hobby, free |
| `apps/prosecutor` | A daemon: three scanners on timers, an indexer, a submission queue in front of a hot key, an SSE fan-out held open for minutes. | Render | Web Service, free |

They are split because the worker **has to be running when every browser tab is closed**. That rules
out putting it on the same platform as the dashboard: a serverless function has no process between
requests, so the scanner intervals never fire, `store.ts` writes to a filesystem that evaporates, and
the in-process `bus` that fans events out to `/api/stream` cannot reach a stream held in a different
invocation. Vercel, Netlify and Cloudflare Workers all fail the same way, for the same reason.

## Order

**The worker goes up first.** `apps/web/lib/api.ts` reads `NEXT_PUBLIC_WORKER_API_URL`, and Next
inlines it into the browser bundle at build time. Deploy the dashboard first and it ships pointing at
`http://localhost:8080`; changing the variable afterwards fixes nothing until you rebuild.

```
Render  →  copy the https URL  →  Vercel env  →  build  →  pinger
```

---

## 1 — Worker on Render

`render.yaml` at the repo root is the blueprint. New → Blueprint, point it at the repo, and Render
reads the service definition from it. Everything in it is `sync: false`, so all values are set in the
dashboard and none are committed.

### Environment

Copy from your `.env`, with three deliberate exclusions:

- **no `NEXT_PUBLIC_*`** — browser configuration, belongs to the Vercel project
- **no `DEPLOYER_PK`, no `SEPOLIA_DEMO_PK`** — deploy-time keys the worker never uses. A host that
  cannot use a key should not hold one.
- **no `DATABASE_URL`** — the JSON store is the driver. `src/db/schema.sql` is the unused Postgres path.

`PROSECUTOR_PK` is the one key this service needs. Set it as a Render environment variable, never as
a build argument and never in `render.yaml`. **Fund that address with only the CTC the demo needs and
rotate it after the hackathon** — it is a hot key living on a shared host, and it should be treated as
compromised by default.

`PORT` is injected by Render. `config.ts` reads it ahead of `WORKER_PORT`, which stays as the local
override — bind the wrong port and Render's health check never passes, and the service is killed as
unhealthy before it has done anything wrong.

### Refresh the anchors before the final deploy

The free plan has no persistent disk, so `.data/watchtower.json` is lost on every spin-down and every
deploy, and the scanners restart from their cold-store watermarks. Two of the three clamp themselves
close to the head, but the reserve stream does not:

| Scanner | Cold start | Catch-up |
|---|---|---|
| `intraBlock.ts` | `safeHead - 1` | immediate |
| `feed.ts` | `max(FEED_ANCHOR_HEIGHT, safeHead - 2000)` | ≤ 2000 blocks |
| `stream.ts` | `BRIDGE_ANCHOR_HEIGHT`, unclamped | as far back as you set it |

So move both anchors close to the head before the deploy you demo from:

```bash
echo $(( $(cast block-number --rpc-url mainnet) - 500 ))    # -> FEED_ANCHOR_HEIGHT
```

`BRIDGE_ANCHOR_HEIGHT` has to stay at the `DemoBridge` deployment height for the reserve ledger to be
well-defined, so that one is a redeploy of the bridge, not an edit. On a Sepolia testnet it is cheap.

---

## 2 — Dashboard on Vercel

- **Root Directory**: `apps/web`. Vercel detects `pnpm-workspace.yaml` and installs from the repo
  root, which `workspace:*` deps require. If it does not, set the build command explicitly:
  `cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @watchtower/web build`
- **Environment**: every `NEXT_PUBLIC_*` key from `.env`, plus the worker:

  ```
  NEXT_PUBLIC_WORKER_API_URL=https://<your-service>.onrender.com
  ```

  **https, not http.** The dashboard is served over https, so a plain-http worker is blocked as mixed
  content — `/api/stream` included, silently.

`next.config.mjs` already handles the hosted case: it forwards `NEXT_PUBLIC_*` keys out of the root
`.env` when that file exists, returns nothing when it does not, and a real platform variable always
wins over the file. Nothing to change.

---

## 3 — Keep it warm

Render's free plan spins a service down after 15 minutes with **no inbound HTTP traffic** — the
scanner timers running inside the process do not count. Point a free scheduler at the health
endpoint every 5 minutes:

```
GET https://<your-service>.onrender.com/api/health
```

cron-job.org or UptimeRobot both do this on a free account. It does two jobs: the container never
idles into a spin-down, and you find out the worker died rather than a judge finding out.

**The cap that matters:** the free plan grants 750 instance-hours per month and a service kept awake
around the clock uses about 730. That fits for exactly one service — which is why the dashboard is on
Vercel — but it means nothing else can share the free plan with it.

---

## Verifying

Run these in order; each one gates the next.

```bash
WORKER=https://<your-service>.onrender.com

# 1. the worker is up and correctly configured
curl -s $WORKER/api/health | jq '{chainId, ok, prosecutorKeyed, submitEnabled, rpcStatus}'
#    chainId must be 102031, every rpcStatus "ok", prosecutorKeyed true

# 2. SSE survives the platform proxy - should hold open and emit `: ping` every 20s
curl -N $WORKER/api/stream

# 3. catch-up has finished
curl -s $WORKER/api/health | jq .cursorLag
```

Then on the deployed dashboard:

4. Open devtools → Network and confirm requests go to the `https://` Render host and **not** to
   `localhost:8080`. That is the build-time inlining check, and it is the one that bites.
5. Pause the pinger, wait 20 minutes, load `/dashboard`. The warm-up panel should appear with real
   block numbers, resolve to live, and celebrate once. Reload — it must not celebrate again.
6. Stop the service entirely. After 90 seconds the warm-up panel gives up and the offline banner
   takes over, while `/subjects`, `/vault` and every wallet action keep working.
7. Run a real prosecution from the deployed site, end to end, and watch the narration through to
   settlement. **This is the demo. It has to pass on the deployed URL, not on a laptop.**

## What still works with the worker down

Worth knowing before a demo, because it is most of the application:

| Works | Does not |
|---|---|
| Landing page and its live numbers | The incident feed |
| `/subjects` — the whole catalogue, accumulators, tranches, bounty pools | `/prosecute` — proof building lives in the worker |
| `/vault` — everything but the leaderboard | The leaderboard |
| Buying cover, staking, claiming premiums, funding a watch, challenging | Live SSE narration |

`useChainState` reads Creditcoin directly and is the backbone of every one of those routes. The
worker holds history and the ability to build a proof, and nothing else.

## Known limits of this setup

- **No persistent disk on the free plan.** Worker state is lost on each spin-down and deploy, and the
  duplicate-submission guard goes with it. The pinger is what prevents this in practice. If repeated
  submissions start burning CTC, move to a Render paid instance with a disk, or to Railway — a
  configuration change, not a code change.
- **Alchemy free tier.** `LOG_RANGE=10` already works around the range cap, but a worker running
  around the clock burns compute units far faster than laptop runs do. Watch the key through demo week.
- **Cold start is real.** Roughly 30-60s before `/api/health` answers, because the worker verifies the
  chain id and the protocol's chain mapping before the API binds. That is the wait `WorkerWarmup`
  narrates.
