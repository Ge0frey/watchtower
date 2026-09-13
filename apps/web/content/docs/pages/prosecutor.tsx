import type { DocSection } from '../schema';
import { A, C, S } from '@/components/docs/DocBody';

export const prosecutor: DocSection = {
  title: 'The prosecutor',
  pages: [
    /* ==================================================================== */
    {
      slug: 'worker',
      title: 'The worker',
      lede: 'One process: three scanners, a single-flight queue in front of a hot key, an indexer and an API.',
      keywords: ['worker', 'prosecutor', 'scanner', 'queue', 'candidate', 'store', 'cursor', 'replay', 'daemon'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              The prosecutor is the only long-lived process in the system, and it is{' '}
              <S>completely untrusted</S>. It finds candidate incidents, waits for attestation, builds
              proofs, pays gas and takes bounties. It cannot forge a verdict — everything it submits is
              re-verified by the precompile inside the settling transaction.
            </>
          ),
        },

        { kind: 'h2', text: 'Three scanners' },
        {
          kind: 'table',
          head: ['Scanner', 'Watches', 'Cadence', 'Cold start'],
          rows: [
            [
              <C key="a">intraBlock.ts</C>,
              'Pools, for three consecutive indices with the same sender outside a stranger',
              '12s',
              <C key="b">safeHead - 1</C>,
            ],
            [
              <C key="a">stream.ts</C>,
              'Custodians, for Locked / Unlocked / Minted / Burned',
              '20s',
              <C key="b">BRIDGE_ANCHOR_HEIGHT</C>,
            ],
            [
              <C key="a">feed.ts</C>,
              'A Chainlink aggregator, for AnswerUpdated',
              '120s',
              <>
                <C>max(FEED_ANCHOR_HEIGHT, safeHead - 2000)</C>
              </>,
            ],
          ],
        },
        {
          kind: 'p',
          children: (
            <>
              Ethereum blocks land every ~12 seconds, so there is nothing to gain from polling faster.
              All three stay <C>SCAN_CONFIRMATIONS</C> (8) behind the source head, so evidence is
              finalised before it is proven, and slice every <C>eth_getLogs</C> to{' '}
              <C>LOG_RANGE</C> (10) blocks because Alchemy&rsquo;s free tier hard-caps the range and
              rejects wider queries rather than throttling them.
            </>
          ),
        },

        { kind: 'h2', text: 'Scanners hold no cursor of their own' },
        {
          kind: 'statement',
          children: (
            <>
              Each tick reads the proven cursor from Creditcoin and works forward from it. Progress is
              only ever recorded by a confirmed receipt.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              This is stronger than committing a local cursor after a receipt, because there is{' '}
              <S>no local cursor left to get ahead of the chain</S>. <C>lastScanned</C> survives only
              as a <em>nothing-here</em> watermark. Delete the worker&rsquo;s entire store and the
              system still works — only the charts go dark.
            </>
          ),
        },

        { kind: 'h2', text: 'The candidate lifecycle' },
        {
          kind: 'code',
          caption: 'States',
          code: `DETECTED → AWAITING_ATTESTATION → PROVING → PREFLIGHT → SUBMITTED
                                                          ├→ CONFIRMED
                                                          ├→ FAILED
                                                          └→ UNPROVABLE`,
        },
        {
          kind: 'p',
          children: (
            <>
              The store is written atomically — write to a temporary file, then rename — so a crash
              mid-write cannot corrupt it. Anything non-terminal is replayed on boot.{' '}
              <C>UNPROVABLE</C> is terminal and deliberate: a window the deployed rule cannot price is
              recorded as such rather than retried forever.
            </>
          ),
        },

        { kind: 'h2', text: 'One queue in front of the hot key' },
        {
          kind: 'p',
          children: (
            <>
              Submissions are single-flight. One key, one in-flight transaction, one nonce — which is
              the simplest correct answer and removes an entire class of nonce-collision failures. The
              retry policy is <C>MAX_ATTEMPTS</C> (6) with exponential backoff from{' '}
              <C>BACKOFF_BASE_MS</C> (15s).
            </>
          ),
        },

        { kind: 'h2', text: 'Persistence' },
        {
          kind: 'p',
          children: (
            <>
              The default store is an atomically-replaced JSON file, so the worker runs with{' '}
              <S>no infrastructure at all</S>. <C>src/db/schema.sql</C> carries the identical shape for
              Postgres, for when several workers share state. The interface is the same either way —
              see <A href="/docs/decisions">Decisions</A> for why the file store is the default.
            </>
          ),
        },

        { kind: 'h2', text: 'Boot assertions' },
        {
          kind: 'p',
          children: (
            <>
              The worker verifies the Creditcoin chain id and the protocol&rsquo;s chain-key mapping{' '}
              <S>before the API binds</S>, and refuses to start if either is wrong. A misconfiguration
              becomes a boot failure with a readable message rather than a confusing revert twenty
              minutes into a run.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Worker boot',
          code: `WATCHTOWER prosecutor
  creditcoin      chainId 102031
  attestcoin      chainKey 1 -> Sepolia, chainKey 3 -> Mainnet
  prosecutor      0x…  4.2 CTC`,
        },
        {
          kind: 'note',
          tone: 'pending',
          title: 'That is also the cold start',
          children: (
            <>
              Roughly 30–60 seconds before <C>/api/health</C> answers, because those assertions run
              first. On a host that spins down between demos, that wait is real — it is what{' '}
              <C>WorkerWarmup</C> narrates in the interface.
            </>
          ),
        },

        { kind: 'h2', text: 'Configuration' },
        {
          kind: 'table',
          head: ['Variable', 'Default', 'What it does'],
          rows: [
            [<C key="a">PORT</C>, '→ WORKER_PORT → 8080', 'Read in that order — every container host injects PORT'],
            [<C key="a">SUBMIT_ENABLED</C>, 'true', 'false runs the worker as a pure indexer + API'],
            [<C key="a">SCAN_INTRA_BLOCK</C>, 'true', 'Disable the sandwich scanner'],
            [<C key="a">SCAN_STREAM</C>, 'true', 'Disable the reserve scanner'],
            [<C key="a">SCAN_FEED</C>, 'true', 'Disable the price scanner'],
            [<C key="a">LOG_RANGE</C>, '10', 'Blocks per eth_getLogs — the Alchemy free-tier cap'],
            [<C key="a">SCAN_CONFIRMATIONS</C>, '8', 'How far behind the source head to stay'],
            [<C key="a">MAX_WINDOW</C>, '10', "Transactions per submission — the protocol's batch ceiling"],
            [<C key="a">PROSECUTOR_BOND_WEI</C>, '0.1 CTC', 'Bond escrowed per optimistic breach'],
            [<C key="a">WORKER_DATA_DIR</C>, <C key="b">.data</C>, 'Where the JSON store lives'],
          ],
        },

        { kind: 'h2', text: 'RPC transport' },
        {
          kind: 'p',
          children: (
            <>
              If a fallback endpoint is set, the worker <S>races both</S> and takes the first good
              answer, so one provider going down does not stall a scanner. Leave the fallbacks blank
              and the transport degrades to a plain single HTTP provider; nothing else changes. See{' '}
              <A href="/docs/environment">Environment</A> for which public endpoints actually work.
            </>
          ),
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'worker-api',
      title: 'Worker API',
      lede: 'Nine endpoints. History, enrichment and narration — and not one of them decides money.',
      keywords: ['api', 'rest', 'sse', 'health', 'stream', 'endpoints', 'prosecute', 'leaderboard'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              The worker exposes a small REST surface and one SSE stream. Everything here is{' '}
              <S>presentation only</S>. Reserves, cover, vault balances, the proven head and the price
              are read from Creditcoin directly by the browser; if the two disagree, the chain wins.
            </>
          ),
        },

        { kind: 'h2', text: 'Endpoints' },
        {
          kind: 'table',
          head: ['Route', 'Returns'],
          rows: [
            [<C key="a">GET /api/subjects</C>, 'The catalogue, enriched with accumulators, tranches and bounty pools'],
            [<C key="a">GET /api/incidents</C>, 'The archive, newest first. Takes ?limit'],
            [<C key="a">GET /api/incidents/:id</C>, 'One incident with its decoded evidence'],
            [<C key="a">GET /api/candidates</C>, 'The 50 most recent pipeline candidates and their states'],
            [<C key="a">GET /api/leaderboard</C>, 'Prosecutors by submissions and bounties taken'],
            [<C key="a">GET /api/rules</C>, 'The static rule table. No store read, no RPC'],
            [<C key="a">GET /api/health</C>, 'Chain id, prosecutor balance, RPC status, attested heads, cursor lag, queue depth'],
            [<C key="a">POST /api/prosecute</C>, 'Build and submit (relayed), or return ready-to-sign calldata (self)'],
            [<C key="a">GET /api/stream</C>, 'SSE pipeline narration, held open for minutes'],
          ],
        },

        { kind: 'h2', text: 'Health, and the number that matters' },
        {
          kind: 'code',
          caption: 'Shell',
          code: `curl -s localhost:8080/api/health \\
  | jq '{ok, prosecutorBalanceCtc, attestedHeads, cursorLag, rpcStatus}'`,
        },
        {
          kind: 'p',
          children: (
            <>
              <C>cursorLag</C> is the one worth watching. It separates <em>nothing has happened
              lately</em> from <em>the prosecutor stopped working an hour ago</em> — two states that
              look identical on a dashboard showing only the latest verdict. Under about 50 blocks per
              stream subject is healthy.
            </>
          ),
        },
        {
          kind: 'note',
          tone: 'pending',
          title: 'Do not ping this one',
          children: (
            <>
              <C>/api/health</C> costs six RPC round trips per call. To keep a free host awake, ping{' '}
              <C>/api/rules</C> instead — it returns a static object and reads nothing. See{' '}
              <A href="/docs/hosting">Hosting</A>.
            </>
          ),
        },

        { kind: 'h2', text: 'Prosecuting over HTTP' },
        {
          kind: 'p',
          children: (
            <>
              <C>POST /api/prosecute</C> takes transaction hashes, a subject and a mode.{' '}
              <C>relayed</C> builds the proof, pays the gas and takes the bounty. <C>self</C> returns
              ready-to-sign calldata and submits nothing — the bounty goes to whoever signs.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              Both paths run the read-only pre-flight first, so an unprovable window is rejected before
              anyone spends gas on it.
            </>
          ),
        },

        { kind: 'h2', text: 'The stream' },
        {
          kind: 'p',
          children: (
            <>
              <C>GET /api/stream</C> is Server-Sent Events, held open for the length of an attestation
              wait — which is minutes, not seconds. It emits a <C>: ping</C> comment every 20 seconds
              so platform proxies do not close it as idle.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `curl -N https://<worker>/api/stream    # should hold open and ping every 20s`,
        },
        {
          kind: 'note',
          tone: 'breach',
          title: 'https, not http',
          children: (
            <>
              A dashboard served over https blocks a plain-http worker as mixed content — the SSE
              stream included, <S>silently</S>. This is the single most common hosted-deployment
              failure. <A href="/docs/troubleshooting">Troubleshooting</A> has the check.
            </>
          ),
        },
      ],
    },
  ],
};
