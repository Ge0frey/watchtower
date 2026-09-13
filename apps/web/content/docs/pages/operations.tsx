import type { DocSection } from '../schema';
import { A, C, S } from '@/components/docs/DocBody';

export const operations: DocSection = {
  title: 'Operating it',
  pages: [
    /* ==================================================================== */
    {
      slug: 'environment',
      title: 'Environment',
      lede: 'Twenty-odd values in .env, but only three are things you create.',
      keywords: ['env', 'dotenv', 'keys', 'rpc', 'alchemy', 'faucet', 'funding', 'anchor', 'aggregator'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              The rest are public addresses you look up once, or outputs the deploy scripts print for
              you. Work through them in this order — <S>A → B → C → deploy → D → E</S> — because each
              group depends on the one before it.
            </>
          ),
        },
        {
          kind: 'table',
          head: ['Group', 'Values', 'Where they come from'],
          rows: [
            [
              'A — you generate',
              <>
                <C>DEPLOYER_PK</C>, <C>PROSECUTOR_PK</C>, <C>SEPOLIA_DEMO_PK</C>
              </>,
              <>
                <C>cast wallet new</C>, then fund them
              </>,
            ],
            [
              'B — you sign up for',
              <>
                <C>MAINNET_RPC</C>, <C>SEPOLIA_RPC</C>
              </>,
              'Alchemy / Infura free tier',
            ],
            [
              'C — public, look up once',
              <>
                <C>DEMO_POOL_MAINNET</C>, <C>DEMO_AGGREGATOR_MAINNET</C>, <C>FEED_ANCHOR_HEIGHT</C>
              </>,
              'resolved below',
            ],
            [
              'D — printed by the deploy scripts',
              <>
                every contract address, every <C>SUBJECT_*</C>, <C>BRIDGE_ANCHOR_HEIGHT</C>
              </>,
              'copy from script output',
            ],
            [
              'E — copies of D',
              <>
                <C>NEXT_PUBLIC_*</C>, <C>DEMO_FAILED_TX_WATCH</C>
              </>,
              'paste the same values',
            ],
          ],
        },

        { kind: 'h2', text: 'A. The three private keys' },
        {
          kind: 'note',
          tone: 'breach',
          title: 'Testnet-only throwaway keys',
          children: (
            <>
              Generate them yourself. Never reuse a key that holds real funds, and never commit them.
            </>
          ),
        },
        { kind: 'code', caption: 'Shell', code: `cast wallet new        # run three times` },
        {
          kind: 'table',
          head: ['Variable', 'Role', 'Funding', 'Why that much'],
          rows: [
            [
              <C key="a">DEPLOYER_PK</C>,
              'Deploys the Creditcoin contracts, owns the registry and vault, runs the seed',
              '~10 CTC',
              'Deploy gas is small; the seed spends 8.30 CTC — 7 staked, 1.25 into bounty pools, 0.05 in premiums',
            ],
            [
              <C key="a">PROSECUTOR_PK</C>,
              "The worker's hot key: builds proofs, pays gas, posts bonds",
              '~2 CTC',
              'Gas per proof is 2.6e-5 to 9.3e-4 CTC; each optimistic breach escrows a 0.1 CTC bond',
            ],
            [
              <C key="a">SEPOLIA_DEMO_PK</C>,
              'Deploys and operates DemoBridge — locks, mints, stages the insolvency',
              '~0.05 Sepolia ETH',
              'Contract deployment, plus lock{value: 0.01 ether} at deploy and the staged incidents',
            ],
          ],
        },
        {
          kind: 'p',
          children: (
            <>
              <C>DEPLOYER_PK</C> does <S>not</S> need Sepolia ETH — <C>DeploySepolia.s.sol</C> signs
              with <C>SEPOLIA_DEMO_PK</C>. You can use one key for all three to get moving, but keep
              them separate for a demo: the prosecutor balance is a badge in the chrome, and it reads
              better when it is genuinely a third party.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              If the faucet gives you less than 10 CTC, scale the seed down instead of requesting
              twice — every amount in <C>SeedDemo.s.sol</C> is proportional to <C>SEED_SCALE_BPS</C>,
              and the script checks the deployer&rsquo;s balance before broadcasting rather than
              failing halfway through.
            </>
          ),
        },
        { kind: 'code', caption: 'Shell', code: `SEED_SCALE_BPS=5000 pnpm seed     # half` },

        { kind: 'h3', text: 'Funding' },
        {
          kind: 'bullets',
          items: [
            <>
              <S>Creditcoin testnet CTC</S> — the faucet is a <S>Discord bot, not a web form</S>. Join{' '}
              <A href="https://discord.gg/creditcoin">discord.gg/creditcoin</A>, open the{' '}
              <C>token-faucet</C> channel, and run <C>/faucet address:&lt;your EVM address&gt;</C> for
              the deployer and the prosecutor.
            </>,
            <>
              <S>Sepolia ETH</S> — any public faucet. Fund <C>DEPLOYER_PK</C> and{' '}
              <C>SEPOLIA_DEMO_PK</C>.
            </>,
          ],
        },
        {
          kind: 'code',
          caption: 'Verify',
          code: `cast balance $(cast wallet address --private-key $PROSECUTOR_PK) --rpc-url $CC3_RPC --ether
pnpm balances      # all three keys, each on the chain it spends on`,
        },

        { kind: 'h2', text: 'B. RPC endpoints' },
        {
          kind: 'p',
          children: (
            <>
              Free tier is enough; the scanners poll every 12–120 seconds. <C>CC3_RPC</C> already has a
              working default and needs no key.
            </>
          ),
        },
        {
          kind: 'code',
          caption: '.env',
          code: `MAINNET_RPC=https://eth-mainnet.g.alchemy.com/v2/<key>
SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/<key>`,
        },
        {
          kind: 'note',
          tone: 'proven',
          title: 'Mainnet is not optional',
          children: (
            <>
              <C>chainKey 3</C> is readable from CC3 Testnet, which is what lets Watchtower prosecute{' '}
              <S>real, historical Ethereum sandwiches</S> in a testnet demo — the single best thing
              about it.
            </>
          ),
        },

        { kind: 'h3', text: 'The fallbacks' },
        {
          kind: 'p',
          children: (
            <>
              Optional, and they need no signup. The worker races both endpoints and takes the first
              good answer. These two were tested against the query shapes the scanners actually issue —
              address-filtered <C>eth_getLogs</C> and <C>eth_getBlockByNumber</C> with full
              transactions.
            </>
          ),
        },
        {
          kind: 'code',
          caption: '.env',
          code: `MAINNET_RPC_FALLBACK=https://eth.drpc.org
SEPOLIA_RPC_FALLBACK=https://sepolia.gateway.tenderly.co`,
        },
        {
          kind: 'table',
          head: ['Endpoint', 'Verdict'],
          rows: [
            [<C key="a">eth.drpc.org</C>, 'Works, including unfiltered getLogs — best mainnet fallback'],
            [
              <C key="a">ethereum-rpc.publicnode.com</C>,
              'Works, but refuses getLogs without an address filter. Fine here, since every scanner filters by address',
            ],
            [<C key="a">sepolia.gateway.tenderly.co</C>, 'Works fully — best Sepolia fallback'],
            [<C key="a">1rpc.io/eth</C>, 'Live, but returns HTTP 410 on getLogs — unusable for a scanner'],
            [
              <>
                <C>rpc.ankr.com/eth</C>, <C>cloudflare-eth.com</C>, <C>eth.llamarpc.com</C>,{' '}
                <C>sepolia.drpc.org</C>
              </>,
              'All failing',
            ],
          ],
        },
        {
          kind: 'p',
          children: (
            <>
              <S>The better fallback is a second provider account, not a public node.</S> The point of
              a fallback is decorrelated failure: a free Infura or dRPC key fails independently of
              Alchemy, whereas shared public endpoints tend to be rate-limited exactly when everyone
              else is hammering them too. Public nodes are the zero-effort option and genuinely fine
              for a demo.
            </>
          ),
        },

        { kind: 'h2', text: 'C. Public mainnet addresses' },
        {
          kind: 'code',
          caption: '.env — read from mainnet, not copied from memory',
          code: `# Uniswap V2 USDC/WETH pair  (factory.getPair(USDC, WETH))
DEMO_POOL_MAINNET=0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc
#   token0 = USDC (6 decimals)
#   token1 = WETH (18 decimals)

# Chainlink ETH/USD - the AGGREGATOR, not the proxy
DEMO_AGGREGATOR_MAINNET=0x7d4E742018fb52E48b08BE73d041C18B21de6Fb5`,
        },
        {
          kind: 'note',
          tone: 'breach',
          title: 'The aggregator, not the proxy',
          children: (
            <>
              <C>0x5f4eC3Df…8419</C> is the ETH/USD proxy everyone quotes, and it emits nothing —{' '}
              <C>AnswerUpdated</C> comes from the aggregator behind it. Point the feed subject at the
              proxy and the price tile stays empty forever. The aggregator address <S>changes</S> when
              Chainlink upgrades the feed, so re-read it rather than trusting any document:
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `cast call 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 "aggregator()(address)" --rpc-url $MAINNET_RPC`,
        },
        {
          kind: 'p',
          children: (
            <>
              A consequence worth knowing: token0 on that pair is USDC at 6 decimals, and the ETH/USD
              feed prices WETH. <C>IntraBlockExtraction</C> is therefore deployed with{' '}
              <C>tokenDecimals = 18</C> and <C>pricedSideIsToken0 = false</C>, and it{' '}
              <S>declines</S> to price a sandwich the searcher funded with USDC rather than publishing
              a figure wrong by twelve orders of magnitude.
            </>
          ),
        },

        { kind: 'h3', text: 'FEED_ANCHOR_HEIGHT' },
        {
          kind: 'p',
          children: (
            <>
              Where the price stream starts. A few hundred blocks back from the current head, so the
              first tick has a round to find. Do not set it far back — every intervening block widens
              the first scan.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `echo $(( $(cast block-number --rpc-url $MAINNET_RPC) - 500 ))`,
        },

        { kind: 'h2', text: 'D & E. Deploy, then copy the output' },
        {
          kind: 'p',
          children: (
            <>
              <A href="/docs/deploy">Deploying</A> covers the order and what each script prints. The
              four <C>RULE_*</C> addresses are informational — the core finds rules through the
              registry at call time. The four <C>SUBJECT_*</C> hashes are <S>not</S> optional: the
              worker files evidence against them and the seeder stakes to them.
            </>
          ),
        },
        {
          kind: 'code',
          caption: '.env — the copies',
          code: `# Whose failed transactions are covered. Use the Sepolia demo address so you can stage
# a revert with DemoBridge.alwaysReverts() during a demo:
DEMO_FAILED_TX_WATCH=$(cast wallet address --private-key $SEPOLIA_DEMO_PK)

# The browser cannot read server-side variables - these must be duplicated with the
# NEXT_PUBLIC_ prefix. They are public contract addresses, not secrets:
NEXT_PUBLIC_WATCHTOWER_CORE=$WATCHTOWER_CORE
NEXT_PUBLIC_SUBJECT_REGISTRY=$SUBJECT_REGISTRY
NEXT_PUBLIC_UNDERWRITING_VAULT=$UNDERWRITING_VAULT
NEXT_PUBLIC_WORKER_API_URL=http://localhost:8080`,
        },
        {
          kind: 'note',
          tone: 'pending',
          title: 'Restart the web app after setting these',
          children: (
            <>
              Next.js inlines <C>NEXT_PUBLIC_*</C> at <S>build time</S>. Changing one in a running dev
              server, or on a hosting platform after a build, fixes nothing until it rebuilds.
            </>
          ),
        },

        { kind: 'h2', text: 'Check it worked' },
        {
          kind: 'code',
          caption: 'Shell',
          code: `pnpm verify:precompile     # the integration, against the live chain
pnpm balances              # keys funded
pnpm worker                # boots only if its own assumptions hold
pnpm seed                  # capital, cover and bounties
pnpm thesis 0xFRONTRUN 0xVICTIM 0xBACKRUN   # the thesis, on a real mainnet sandwich`,
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'deploy',
      title: 'Deploying',
      lede: 'Two deployments, in a fixed order, with an .env edit between them.',
      keywords: ['deploy', 'forge', 'script', 'mixHash', 'idempotent', 'redeploy', 'seed', 'sepolia'],
      blocks: [
        {
          kind: 'code',
          caption: 'The whole path',
          code: `Sepolia  →  paste 3 values  →  Creditcoin  →  paste 7 values  →  NEXT_PUBLIC copies  →  seed`,
        },
        {
          kind: 'p',
          children: (
            <>
              Sepolia goes first because <C>DeployCreditcoin</C> reads the bridge address and its
              deployment height. The Creditcoin deployment goes before seeding because the seeder
              stakes into subjects that do not exist yet.
            </>
          ),
        },

        { kind: 'h2', text: 'Before you start' },
        {
          kind: 'code',
          caption: 'Shell',
          code: `cd contracts
forge test          # 79 tests, no network
pnpm balances       # from the repo root - all three keys funded`,
        },
        {
          kind: 'note',
          tone: 'neutral',
          title: 'contracts/.env is a symlink',
          children: (
            <>
              Foundry loads <C>.env</C> from the <S>current directory</S>, not the project root, so
              without the symlink <C>vm.envUint(&quot;DEPLOYER_PK&quot;)</C> fails even though the file
              plainly exists one level up. <C>foundry.toml</C> also defines named endpoints, so{' '}
              <C>--rpc-url sepolia</C> works without your shell having sourced anything — which matters
              in fish, where <C>$SEPOLIA_RPC</C> is empty.
            </>
          ),
        },

        { kind: 'h2', text: '1 — Sepolia: the custodian' },
        {
          kind: 'code',
          caption: 'Shell',
          code: `forge script script/DeploySepolia.s.sol --rpc-url sepolia --broadcast`,
        },
        {
          kind: 'p',
          children: (
            <>
              Signs with <C>SEPOLIA_DEMO_PK</C>. Deploys <C>DemoBridge</C>, which deploys its own{' '}
              <C>DemoToken</C>, then locks 0.01 ETH so the reserve ledger starts with real collateral
              behind it. Put the three printed values in <C>.env</C>.
            </>
          ),
        },
        {
          kind: 'code',
          caption: '.env',
          code: `DEMO_BRIDGE_SEPOLIA=0x…      # the custodian ReserveConservation watches
DEMO_TOKEN_SEPOLIA=0x…       # informational - no rule reads it
BRIDGE_ANCHOR_HEIGHT=…       # the deployment block; the stream starts here`,
        },
        {
          kind: 'p',
          children: (
            <>
              <C>BRIDGE_ANCHOR_HEIGHT</C> is what makes the reserve stream well-defined: nothing before
              it is ever expected, so the first ingestion is not a gap.
            </>
          ),
        },

        { kind: 'h2', text: '2 — Creditcoin: the engine' },
        {
          kind: 'p',
          children: (
            <>
              Refresh the feed anchor first, so the price scanner does not sweep thousands of blocks on
              its first tick.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `echo $(( $(cast block-number --rpc-url mainnet) - 500 ))     # -> FEED_ANCHOR_HEIGHT

pnpm deploy:creditcoin        # from the repo root`,
        },
        {
          kind: 'note',
          tone: 'breach',
          title: 'Not forge script, on this chain',
          children: (
            <>
              Creditcoin&rsquo;s RPC omits <C>mixHash</C> from block headers, so alloy cannot
              deserialise a block and <C>forge script</C> — which forks the chain to execute{' '}
              <C>run()</C> and to follow receipts — fails. The dangerous part is <S>how</S> it fails:
              it broadcasts transactions it can then no longer track. The first attempt left three
              receipts out of nineteen transactions and a half-deployed system.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              <C>contracts/script/DeployCreditcoin.s.sol</C> is kept as the readable specification;{' '}
              <C>scripts/deploy-creditcoin.mjs</C> is what actually runs, over plain{' '}
              <C>eth_sendRawTransaction</C> and <C>eth_getTransactionReceipt</C>, which the chain
              serves correctly. It is also <S>idempotent</S>: any address already in <C>.env</C> is
              reused rather than redeployed, so a partial run resumes, and it writes every result back
              to <C>.env</C> for you.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              Signs with <C>DEPLOYER_PK</C>. Deploys the registry, the vault and the core, then the
              four rules, then registers the four subjects and links each priced subject to the feed
              subject.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Printed, ready to paste',
          code: `SUBJECT_REGISTRY=0x…     RULE_INTRABLOCK=0x…    SUBJECT_FEED=0x…
UNDERWRITING_VAULT=0x…   RULE_RESERVE=0x…       SUBJECT_POOL=0x…
WATCHTOWER_CORE=0x…      RULE_FEED=0x…          SUBJECT_BRIDGE=0x…
                         RULE_FAILEDTX=0x…      SUBJECT_ACCOUNT=0x…`,
        },

        { kind: 'h2', text: '3 — Seed' },
        { kind: 'code', caption: 'Shell', code: `pnpm seed                     # from the repo root` },
        {
          kind: 'p',
          children: (
            <>
              Stakes 7 CTC across the three tranches, funds 1.25 CTC of bounty pools, and buys cover so
              a verdict has somewhere to pay. Same reasoning as step 2 — <C>SeedDemo.s.sol</C> is the
              specification, <C>scripts/seed-demo.mjs</C> is the runnable version. It reads what is
              already staked, funded and covered and tops up only the difference, so re-running after a
              partial failure is safe.
            </>
          ),
        },

        { kind: 'h2', text: 'Verify' },
        {
          kind: 'code',
          caption: 'Shell',
          code: `# subjects registered, read straight off the chain
cast call $SUBJECT_REGISTRY "subjectCount()(uint256)" --rpc-url creditcoin     # -> 4

# the vault holds the seed
cast balance $UNDERWRITING_VAULT --rpc-url creditcoin --ether

pnpm worker
pnpm web`,
        },

        { kind: 'h2', text: 'Re-running' },
        {
          kind: 'p',
          children: (
            <>
              <C>pnpm deploy:creditcoin</C> and <C>pnpm seed</C> are both idempotent, and that is the
              whole reason they exist as node scripts. To redeploy <S>cleanly</S> — which you must
              after changing any contract, since the addresses in <C>.env</C> point at the old
              bytecode — blank the deployment block first.
            </>
          ),
        },
        {
          kind: 'code',
          caption: '.env',
          code: `SUBJECT_REGISTRY=      UNDERWRITING_VAULT=      WATCHTOWER_CORE=
RULE_INTRABLOCK=       RULE_RESERVE=            RULE_FEED=        RULE_FAILEDTX=
SUBJECT_POOL=          SUBJECT_BRIDGE=          SUBJECT_FEED=     SUBJECT_ACCOUNT=`,
        },
        {
          kind: 'note',
          tone: 'pending',
          title: 'Partial re-runs against an existing registry do not work',
          children: (
            <>
              <C>registerSubject</C> reverts with <C>SubjectExists</C>, because a subject id is{' '}
              <C>keccak256(chainKey, sourceContract, ruleId)</C> and none of those inputs changed. A
              fresh registry means fresh subject ids, so the accumulators start empty again — re-ingest
              a price and a few <C>Locked</C> events before demoing.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              <C>DeploySepolia</C> is safe to repeat: it deploys a new bridge each time. Update{' '}
              <C>DEMO_BRIDGE_SEPOLIA</C> and <C>BRIDGE_ANCHOR_HEIGHT</C>, and redeploy Creditcoin too,
              because the bridge subject id is derived from the bridge address.
            </>
          ),
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'hosting',
      title: 'Hosting',
      lede: 'Two units with opposite shapes: a static-ish dashboard, and a daemon that must run with every browser tab closed.',
      keywords: ['hosting', 'render', 'vercel', 'deploy', 'sse', 'spin down', 'warm', 'uptime', 'root directory'],
      blocks: [
        {
          kind: 'p',
          children: (
            <>
              <A href="/docs/deploy">Deploying</A> puts the contracts on-chain. This puts the
              application in front of people.
            </>
          ),
        },
        {
          kind: 'table',
          head: ['Unit', 'What it is', 'Where', 'Plan'],
          rows: [
            [
              <C key="a">apps/web</C>,
              'Next 15. Every app route is a client component that reads Creditcoin directly.',
              'Vercel',
              'Hobby, free',
            ],
            [
              <C key="a">apps/prosecutor</C>,
              'A daemon: three scanners on timers, an indexer, a submission queue, an SSE fan-out held open for minutes.',
              'Render',
              'Web Service, free',
            ],
          ],
        },
        {
          kind: 'statement',
          children: (
            <>
              They are split because the worker has to be running when every browser tab is closed.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              That rules out putting it on the same platform as the dashboard. A serverless function
              has no process between requests, so the scanner intervals never fire, the store writes to
              a filesystem that evaporates, and the in-process bus that fans events out to{' '}
              <C>/api/stream</C> cannot reach a stream held in a different invocation. Vercel, Netlify
              and Cloudflare Workers all fail the same way, for the same reason.
            </>
          ),
        },

        { kind: 'h2', text: 'Order' },
        {
          kind: 'note',
          tone: 'breach',
          title: 'The worker goes up first',
          children: (
            <>
              <C>apps/web/lib/api.ts</C> reads <C>NEXT_PUBLIC_WORKER_API_URL</C>, and Next inlines it
              into the browser bundle <S>at build time</S>. Deploy the dashboard first and it ships
              pointing at <C>http://localhost:8080</C>; changing the variable afterwards fixes nothing
              until you rebuild.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'The order',
          code: `Render  →  copy the https URL  →  Vercel env  →  build  →  pinger`,
        },

        { kind: 'h2', text: 'Worker on Render' },
        {
          kind: 'p',
          children: (
            <>
              <C>render.yaml</C> at the repo root is the blueprint. New → Blueprint, point it at the
              repo. Everything in it is <C>sync: false</C>, so all values are set in the dashboard and
              none are committed.
            </>
          ),
        },
        {
          kind: 'bullets',
          items: [
            <>
              <S>Do not put <C>corepack enable</C> in the build command.</S> Render&rsquo;s Node image
              already ships pnpm at <C>/usr/bin/pnpm</C> and mounts <C>/usr/bin</C> read-only, so
              corepack fails trying to unlink the binary it means to replace:{' '}
              <C>EROFS: read-only file system, unlink &apos;/usr/bin/pnpm&apos;</C>. Just call{' '}
              <C>pnpm</C>.
            </>,
            <>
              <S>The repo must be reachable.</S> A private repo returns{' '}
              <C>400 … repository URL is invalid or unfetchable</C> until the Render GitHub App is
              granted access, which is a browser-only step.
            </>,
            <>
              <S>Environment variables can only be set at create time or in the dashboard.</S> There is
              no <C>render env</C> command in CLI v2.28.0 and <C>render services update</C> has no env
              flag. The CLI also cannot launch a blueprint — <C>render blueprints</C> only validates
              one.
            </>,
          ],
        },

        { kind: 'h3', text: 'What the worker gets, and what it must not' },
        {
          kind: 'p',
          children: (
            <>
              Copy from your <C>.env</C>, with three deliberate exclusions: no <C>NEXT_PUBLIC_*</C>{' '}
              (browser configuration, belongs to Vercel), no <C>DEPLOYER_PK</C> and no{' '}
              <C>SEPOLIA_DEMO_PK</C> (deploy-time keys the worker never uses — a host that cannot use a
              key should not hold one), and no <C>DATABASE_URL</C> (the JSON store is the driver).
            </>
          ),
        },
        {
          kind: 'note',
          tone: 'breach',
          title: 'Treat PROSECUTOR_PK as compromised by default',
          children: (
            <>
              It is a hot key living on a shared host. Set it as a dashboard environment variable,
              never as a build argument and never in <C>render.yaml</C>. Fund that address with only
              the CTC the demo needs, and <S>rotate it afterwards</S>.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              <C>PORT</C> is injected by Render, and <C>config.ts</C> reads it ahead of{' '}
              <C>WORKER_PORT</C>. Bind the wrong port and the health check never passes, and the
              service is killed as unhealthy before it has done anything wrong.
            </>
          ),
        },

        { kind: 'h3', text: 'Refresh the anchors before the final deploy' },
        {
          kind: 'p',
          children: (
            <>
              The free plan has no persistent disk, so the store is lost on every spin-down and every
              deploy, and the scanners restart from their cold-store watermarks.
            </>
          ),
        },
        {
          kind: 'table',
          head: ['Scanner', 'Cold start', 'Catch-up'],
          rows: [
            [<C key="a">intraBlock.ts</C>, <C key="b">safeHead - 1</C>, 'immediate'],
            [
              <C key="a">feed.ts</C>,
              <C key="b">max(FEED_ANCHOR_HEIGHT, safeHead - 2000)</C>,
              '≤ 2000 blocks',
            ],
            [
              <C key="a">stream.ts</C>,
              <>
                <C>BRIDGE_ANCHOR_HEIGHT</C>, unclamped
              </>,
              '500 blocks per 20s tick',
            ],
          ],
        },
        {
          kind: 'p',
          children: (
            <>
              The reserve stream is the only unclamped one, but it is not unbounded: at 500 blocks a
              tick on a 20-second timer, a 10,000-block backlog is about 21 ticks —{' '}
              <S>roughly seven minutes</S>, measured on the live deployment, which started ~10,400
              Sepolia blocks behind. <C>BRIDGE_ANCHOR_HEIGHT</C> has to stay at the bridge&rsquo;s
              deployment height for the ledger to be well-defined, so moving that one is a redeploy of
              the bridge, not an edit.
            </>
          ),
        },

        { kind: 'h2', text: 'Dashboard on Vercel' },
        {
          kind: 'bullets',
          items: [
            <>
              <S>Root Directory must be <C>apps/web</C>.</S> This is the whole trick. Getting it wrong
              fails the build with <C>No Next.js version detected</C>, because Vercel looks for{' '}
              <C>next</C> in the package.json at the root directory and the repo root has none. With it
              set, Vercel finds the app <em>and</em> still installs the pnpm workspace from the repo
              root, which <C>workspace:*</C> deps require.
            </>,
            <>
              <S>Leave build, install and output commands empty.</S> The framework preset handles a
              Next app at that root. A root <C>vercel.json</C> with{' '}
              <C>outputDirectory: apps/web/.next</C> is actively wrong once Root Directory is{' '}
              <C>apps/web</C> — the path resolves to <C>apps/web/apps/web/.next</C>.
            </>,
            <>
              The CLI has no flag for Root Directory. Set it through the API:{' '}
              <C>
                vercel api &quot;/v9/projects/&lt;id&gt;?teamId=&lt;team&gt;&quot; -X PATCH -f
                rootDirectory=apps/web
              </C>
              .
            </>,
          ],
        },
        {
          kind: 'p',
          children: (
            <>
              Only four variables are needed, and none is a secret. No RPC keys go to Vercel: the
              browser talks to Creditcoin over the public endpoint in the chain config, and wagmi
              discovers wallets over EIP-6963 with no WalletConnect project id.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Vercel environment',
          code: `NEXT_PUBLIC_WORKER_API_URL=https://<your-service>.onrender.com
NEXT_PUBLIC_WATCHTOWER_CORE=0x…
NEXT_PUBLIC_SUBJECT_REGISTRY=0x…
NEXT_PUBLIC_UNDERWRITING_VAULT=0x…`,
        },
        {
          kind: 'note',
          tone: 'breach',
          title: 'https, not http',
          children: (
            <>
              The dashboard is served over https, so a plain-http worker is blocked as mixed content —{' '}
              <C>/api/stream</C> included, <S>silently</S>. Verify the value landed in the bundle
              rather than trusting the setting, because it is inlined at build time and a stale value
              fails quietly:
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `curl -s https://<site>/dashboard | grep -oP '/_next/static/chunks/[A-Za-z0-9._-]+\\.js' | sort -u \\
  | while read c; do curl -s "https://<site>$c" | grep -l localhost:8080 >/dev/null && echo "STALE: $c"; done`,
        },
        {
          kind: 'p',
          children: (
            <>
              Git is connected, so a push to <C>main</C> rebuilds the site. A CLI{' '}
              <C>vercel deploy --prod</C> uploads the local working tree instead — which means the two
              can disagree. If the CLI shipped an uncommitted fix, the next git push rebuilds{' '}
              <S>without</S> it.
            </>
          ),
        },

        { kind: 'h2', text: 'Keep it warm' },
        {
          kind: 'p',
          children: (
            <>
              Render&rsquo;s free plan spins a service down after 15 minutes with{' '}
              <S>no inbound HTTP traffic</S> — the scanner timers running inside the process do not
              count.
            </>
          ),
        },
        {
          kind: 'note',
          tone: 'pending',
          title: 'Ping /api/rules, not /api/health',
          children: (
            <>
              <C>/api/rules</C> returns a static object: no store read, no RPC. <C>/api/health</C>{' '}
              costs six RPC round trips a call, so pinging that every five minutes spends roughly 1,700
              extra provider calls a day to learn nothing the cheap route has not already proved.
            </>
          ),
        },
        {
          kind: 'p',
          children: (
            <>
              Two layers, because they fail differently. <S>GitHub Actions</S> (
              <C>.github/workflows/keep-worker-warm.yml</C>) is the committed backstop — free on a
              public repo, <C>/api/rules</C> every 5 minutes and <C>/api/health</C> twice an hour with
              the run failing when <C>ok</C> is false. Its weakness is scheduling: GitHub&rsquo;s cron
              is best-effort and gets delayed under load, sometimes past the 15-minute window. An{' '}
              <S>external uptime monitor</S> — cron-job.org at 1-minute resolution, or UptimeRobot at
              5 — is the primary, because it actually schedules on time and alerts faster.
            </>
          ),
        },
        {
          kind: 'note',
          tone: 'neutral',
          title: 'The cap that matters',
          children: (
            <>
              The free plan grants 750 instance-hours a month and a service kept awake around the clock
              uses about 730. That fits exactly one service — which is why the dashboard is on Vercel —
              and it means nothing else can share the free plan with it.
            </>
          ),
        },

        { kind: 'h2', text: 'Verifying a deployment' },
        {
          kind: 'p',
          children: <>Run these in order; each one gates the next.</>,
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `WORKER=https://<your-service>.onrender.com

curl -s $WORKER/api/health | jq '{chainId, ok, prosecutorKeyed, submitEnabled, rpcStatus}'
#   chainId must be 102031, every rpcStatus "ok", prosecutorKeyed true

curl -N $WORKER/api/stream          # must hold open and emit ': ping' every 20s
curl -s $WORKER/api/health | jq .cursorLag    # catch-up finished`,
        },
        {
          kind: 'steps',
          items: [
            <>
              On the deployed dashboard, open devtools → Network and confirm requests go to the{' '}
              <C>https://</C> host and <S>not</S> to <C>localhost:8080</C>. That is the build-time
              inlining check, and it is the one that bites.
            </>,
            <>
              Pause the pinger, wait 20 minutes, load <C>/dashboard</C>. The warm-up panel should
              appear with real block numbers, resolve to live, and celebrate once. Reload — it must not
              celebrate again.
            </>,
            <>
              Stop the service entirely. After 90 seconds the warm-up gives up and the offline banner
              takes over, while <C>/subjects</C>, <C>/vault</C> and every wallet action keep working.
            </>,
            <>
              Run a real prosecution from the deployed site, end to end, through to settlement.{' '}
              <S>This is the demo. It has to pass on the deployed URL, not on a laptop.</S>
            </>,
          ],
        },

        { kind: 'h2', text: 'Known limits of this setup' },
        {
          kind: 'bullets',
          items: [
            <>
              <S>No persistent disk on the free plan.</S> Worker state is lost on each spin-down and
              deploy, and the duplicate-submission guard goes with it. The pinger is what prevents this
              in practice; a paid instance with a disk is a configuration change, not a code change.
            </>,
            <>
              <S>Free-tier RPC.</S> <C>LOG_RANGE=10</C> already works around the range cap, but a
              worker running around the clock burns compute units far faster than laptop runs do.
            </>,
            <>
              <S>Cold start is real.</S> Roughly 30–60s before <C>/api/health</C> answers, because the
              worker verifies the chain id and the chain mapping before the API binds.
            </>,
          ],
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'scripts',
      title: 'Scripts',
      lede: 'Every command, and when to reach for which. Run all of them from the repo root.',
      keywords: ['scripts', 'pnpm', 'commands', 'stage', 'find', 'balances', 'verify', 'capture', 'retire'],
      blocks: [
        { kind: 'h2', text: 'Demo day' },
        {
          kind: 'table',
          head: ['Command', 'What it does'],
          rows: [
            [
              <C key="a">pnpm stage:sandwich</C>,
              <>
                <S>The one you want.</S> Finds a real sandwich, throws away the ones the system cannot
                judge, registers the pool, and prints a link that opens the app with everything already
                filled in.
              </>,
            ],
            [<C key="a">pnpm stage:sandwich --dry-run</C>, 'Same scan, registers nothing. Look before you commit.'],
            [
              <C key="a">pnpm find:sandwich</C>,
              'Just looks. Reports sandwiches and stops — when you want to see what is out there without changing anything.',
            ],
            [<C key="a">pnpm balances</C>, 'Checks all three keys have money. Run this first if anything fails.'],
          ],
        },
        {
          kind: 'note',
          tone: 'neutral',
          title: 'find versus stage',
          children: (
            <>
              <C>find</C> tells you what happened. <C>stage</C> makes it prosecutable. If you are about
              to demo, use <C>stage</C>.
            </>
          ),
        },

        { kind: 'h2', text: 'Setting things up' },
        {
          kind: 'table',
          head: ['Command', 'What it does'],
          rows: [
            [
              <C key="a">pnpm watch &lt;address&gt;</C>,
              'Puts Watchtower on any contract by hand. stage:sandwich calls this for you, so you rarely need it directly. Use it for a bridge or an account rather than a pool.',
            ],
            [<C key="a">pnpm retire &lt;address&gt;</C>, 'Takes a subject back out of the dropdown. Existing verdicts stand.'],
            [
              <C key="a">pnpm demo:skip-gap</C>,
              'Stages the "catch a cheating prosecutor" beat. Submits a deliberately incomplete claim and prints the transaction it skipped, so you can paste that into the challenge panel.',
            ],
          ],
        },

        { kind: 'h2', text: 'Running it' },
        {
          kind: 'table',
          head: ['Command', 'What it does'],
          rows: [
            [<C key="a">pnpm worker</C>, 'Starts the prosecutor on your own machine — scanners, indexer, REST + SSE on :8080.'],
            [<C key="a">pnpm web</C>, 'Starts the site locally on port 3000.'],
          ],
        },

        { kind: 'h2', text: 'Checking it works' },
        {
          kind: 'table',
          head: ['Command', 'What it does'],
          rows: [
            [<C key="a">pnpm verify</C>, 'Builds the contracts, runs all 79 tests, typechecks everything. The full health check.'],
            [
              <C key="a">pnpm verify:precompile</C>,
              'Asks the live Creditcoin precompile to prove a real Ethereum transaction. Confirms the integration itself is alive.',
            ],
            [
              <C key="a">pnpm thesis &lt;tx&gt; &lt;tx&gt; &lt;tx&gt;</C>,
              'Walks through one sandwich and shows the proof being built, step by step. Good for explaining how it works — and it warms the Proof Builder cache.',
            ],
            [<C key="a">pnpm typecheck</C>, 'Types only. Fast.'],
            [<C key="a">pnpm test:contracts</C>, 'Contract tests only. No network needed.'],
          ],
        },

        { kind: 'h2', text: 'Rarely, and only once' },
        {
          kind: 'table',
          head: ['Command', 'What it does'],
          rows: [
            [
              <C key="a">pnpm deploy:creditcoin</C>,
              'Deploys the contracts. Running it again against blank .env addresses makes a second, separate deployment.',
            ],
            [<C key="a">pnpm seed</C>, 'Puts the starting money into the vault. Idempotent — it tops up rather than adds.'],
            [
              <C key="a">pnpm capture &lt;tx&gt;…</C>,
              'Freezes a real proof into fixtures/ so the test suite can replay it offline.',
            ],
            [<C key="a">pnpm abis</C>, 'Regenerates the contract interfaces the website uses. Only after changing a contract.'],
          ],
        },

        { kind: 'h2', text: 'If you only remember three' },
        {
          kind: 'code',
          caption: 'Shell',
          code: `pnpm balances          # is everything funded
pnpm stage:sandwich    # get a prosecutable sandwich, ready to paste
pnpm verify            # is anything broken`,
        },
      ],
    },

    /* ==================================================================== */
    {
      slug: 'runbook',
      title: 'Demo runbook',
      lede: 'Four minutes, one screen, no scene changes — and the one constraint that shapes all of it.',
      keywords: ['demo', 'runbook', 'beats', 'stage', 'fallback', 'timing', 'attestation', 'script'],
      blocks: [
        {
          kind: 'note',
          tone: 'breach',
          title: 'The constraint that shapes everything',
          children: (
            <>
              Attestation takes <S>about eight minutes end to end</S> — not the ~2-minute attestation
              cadence. Every live beat must act on evidence that is <S>already attested</S>. Stage
              Sepolia incidents at <C>T-20 min</C>, never on stage.
            </>
          ),
        },

        { kind: 'h2', text: 'T-60: seed' },
        {
          kind: 'code',
          caption: 'Shell',
          code: `pnpm seed        # stake, cover, bounties - idempotent, tops up to the target
pnpm worker      # scanners + API
pnpm web         # dashboard`,
        },
        {
          kind: 'p',
          children: (
            <>
              Let the feed scanner ingest a Chainlink round and the stream scanner ingest a few{' '}
              <C>Locked</C> events, so the proven-head badge and the ETH/USD tile are live before
              anyone looks at the screen.
            </>
          ),
        },

        { kind: 'h2', text: 'T-20: stage the live incidents' },
        {
          kind: 'code',
          caption: 'Sepolia staging',
          code: `cast send $DEMO_BRIDGE_SEPOLIA "lock()" --value 0.01ether \\
  --rpc-url $SEPOLIA_RPC --private-key $SEPOLIA_DEMO_PK

cast send $DEMO_BRIDGE_SEPOLIA "mintUnbacked(address,uint256)" $HOLDER 20000000000000000 \\
  --rpc-url $SEPOLIA_RPC --private-key $SEPOLIA_DEMO_PK

cast send $DEMO_BRIDGE_SEPOLIA "alwaysReverts()" \\
  --rpc-url $SEPOLIA_RPC --private-key $SEPOLIA_DEMO_PK --gas-limit 100000`,
        },
        {
          kind: 'p',
          children: (
            <>
              Then find a sandwich that actually exists — which pools are being sandwiched changes week
              to week, and the canonical UniV2 USDC/WETH pair goes thousands of blocks without one
              because that flow moved to V3.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `pnpm find:sandwich --span 150                     # scan, do not assume
pnpm watch 0xPOOL --label "UniV2 DAI/WETH" --bounty 0.25 --stake 1
pnpm thesis 0xFRONTRUN 0xVICTIM 0xBACKRUN        # warm the proof - comes back cached
pnpm demo:skip-gap                               # prints the tx it will skip - keep it on the clipboard`,
        },

        { kind: 'h2', text: 'T-5: health check' },
        {
          kind: 'p',
          children: (
            <>
              <C>/api/health</C> must show <C>ok: true</C>, a prosecutor balance above 2 CTC, every RPC
              green, attested heads advancing, <C>cursorLag</C> under ~50 blocks per stream subject,
              SSE connected and the vault funded. And every staged transaction must{' '}
              <S>already be attested</S> — if one is not, drop that beat rather than waiting on stage.
            </>
          ),
        },
        {
          kind: 'code',
          caption: 'Shell',
          code: `curl -s localhost:8080/api/health | jq '{ok, prosecutorBalanceCtc, attestedHeads, cursorLag, rpcStatus}'`,
        },

        { kind: 'h2', text: 'The run' },
        {
          kind: 'table',
          head: ['Time', 'Beat', 'Action', 'Fallback'],
          rows: [
            [
              '0:00',
              'Cold open',
              'Nothing. The dashboard is already alive: proven head ticking, ETH/USD proven from Chainlink’s own transaction.',
              '—',
            ],
            [
              '0:25',
              'A real sandwich',
              'Paste the pre-warmed mainnet hashes → Prosecute. Three adjacent cells light; the verdict names the real attacker, victim and pool, with damages in dollars at the price Chainlink itself published.',
              'A second warmed triple; last resort, open the settled incident already in the feed.',
            ],
            [
              '1:25',
              'A custodian goes insolvent',
              'The staged over-mint is already attested — the stream scanner ingests it, the reserve tile flips red, a bonded breach opens.',
              'Pre-staged breach already open.',
            ],
            [
              '2:05',
              'Attack your own system',
              'pnpm demo:skip-gap steps over the staged Locked and prints the hash. Paste it into the incident’s Challenge panel. Bond slashed, accumulator rolled back, live in the same feed.',
              'Run forge test --match-path test/unit/GapChallenge.t.sol -vv on screen and narrate.',
            ],
            [
              '2:45',
              'A new risk in sixty lines',
              'Prosecute the staged reverted transaction. “Same engine, same vault, same feed — this rule is sixty lines long.”',
              'Show FailedTx.sol; it is short enough to read aloud.',
            ],
            [
              '3:10',
              'Open the market',
              'Take a contract address from the room: pnpm watch 0xADDR registers it and funds the bounty in one command, and it appears within one poll.',
              'Use a prepared address, or fund an existing subject from the Fund-a-watch panel.',
            ],
            [
              '3:35',
              'Close',
              'Writability: verdicts become enforceable messages back on Ethereum — restitution, not reimbursement.',
              '—',
            ],
          ],
        },
        {
          kind: 'statement',
          children: (
            <>
              Beat 4 is the one nobody else will do: demonstrating an attack on your own protocol{' '}
              <em>and its defence</em>, using the same protocol, on stage.
            </>
          ),
        },

        { kind: 'h2', text: 'Lines worth saying exactly' },
        {
          kind: 'bullets',
          items: [
            <>
              &ldquo;An Ethereum contract cannot see the transactions beside it in its own block. A
              Creditcoin contract can. That is the entire product.&rdquo;
            </>,
            <>
              &ldquo;$34.00 — at the price Chainlink itself published in block 21,340,118, proven by
              the precompile, not reported by us.&rdquo;
            </>,
            <>
              &ldquo;You cannot prove a negative on-chain, so we do not pretend to. Solvency claims are
              bonded and challengeable. Here is the challenge working.&rdquo;
            </>,
            <>&ldquo;This rule is sixty lines. The engine is the product; the rules are the catalogue.&rdquo;</>,
            <>
              On a mainnet sandwich paying nothing — say it before anyone asks: &ldquo;Restitution is
              zero, and that is the system working. The victim is a real stranger on mainnet who never
              bought cover. The verdict still stands, the prosecutor still got paid for proving it.
              Insurance pays the insured.&rdquo;
            </>,
            <>
              &ldquo;That prosecution cost 1.64 % of one Creditcoin block. Three Ethereum transactions
              verified, three indices derived by the precompile, a rule evaluated and the vault
              moved.&rdquo;
            </>,
          ],
        },

        { kind: 'h2', text: 'If something breaks' },
        {
          kind: 'terms',
          items: [
            {
              term: 'Proof builder slow',
              body: (
                <>
                  The warmed proof returns <C>cached: true</C>. Say so — it is a feature.
                </>
              ),
            },
            {
              term: 'A live beat is not attested yet',
              body: 'Skip it, open a settled incident instead, and explain the eight-minute floor as a property of decentralised attestation rather than an apology.',
            },
            {
              term: 'Worker out of CTC',
              body: 'The header badge goes red before anything fails. Top it up at T-5.',
            },
            {
              term: 'The warmed sandwich is stale',
              body: (
                <>
                  <C>pnpm find:sandwich</C> again and <C>pnpm watch</C> the new pool — registering takes
                  two transactions and a few seconds.
                </>
              ),
            },
            {
              term: 'Damages shown, zero paid',
              body: 'Expected on a real mainnet victim. Use the line above.',
            },
          ],
        },
      ],
    },
  ],
};
