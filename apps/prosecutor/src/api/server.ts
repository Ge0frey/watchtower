import Fastify from 'fastify';
import cors from '@fastify/cors';
import { formatEther, type Address, type Hex } from 'viem';
import { attestedHead, createClient, toEvidenceInput, buildEvidenceBundle } from '@watchtower/attestcoin';
import { RULES, ruleByIdOrNull, type ChainKey, type HealthReport } from '@watchtower/shared';
import { bus } from '../bus.js';
import { config } from '../config.js';
import { publicClient, readBountyPool, readSubjects, readVaultTranche, prosecutorWallet } from '../chain.js';
import { store } from '../db/store.js';
import { queue } from '../pipeline/queue.js';

const attestcoin = createClient();

/** BigInt does not survive JSON.stringify; every numeric leaves as a decimal string. */
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));

export async function startApi() {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  app.get('/api/subjects', async () => {
    const subjects = await readSubjects();
    const enriched = await Promise.all(
      subjects.map(async (s) => ({
        id: s.id,
        label: s.subject.label,
        kind: s.subject.kind,
        chainKey: Number(s.subject.chainKey),
        sourceContract: s.subject.sourceContract,
        rule: ruleByIdOrNull(s.subject.boundRule)?.name ?? 'unknown',
        ruleId: s.subject.boundRule,
        active: s.subject.active,
        payoutCapPerBlock: s.subject.payoutCapPerBlock,
        priceSubject: s.subject.priceSubject,
        state: s.state,
        tranche: await readVaultTranche(s.id),
        bountyPool: await readBountyPool(s.id),
      })),
    );
    return json(enriched);
  });

  app.get('/api/incidents', async (req) => {
    const limit = Number((req.query as { limit?: string }).limit ?? 50);
    return json(store.incidents(limit));
  });

  app.get('/api/incidents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const incident = store.incident(id);
    if (!incident) return reply.code(404).send({ error: 'unknown incident' });
    return json(incident);
  });

  /** Detected but not yet prosecuted - the queue, visible. */
  app.get('/api/candidates', async () => json(store.candidates().slice(0, 50)));

  app.get('/api/leaderboard', async () => json(store.leaderboard()));

  app.get('/api/rules', async () => json(Object.values(RULES)));

  app.get('/api/health', async () => {
    const wallet = prosecutorWallet();
    const address = (await wallet.getAddress()) as Address;
    const balance = await publicClient.getBalance({ address });

    const heads: Record<number, number> = {};
    const rpcStatus: Record<string, 'ok' | 'down'> = {};
    for (const chainKey of [1, 3] as ChainKey[]) {
      try {
        heads[chainKey] = await attestedHead(attestcoin, chainKey);
        rpcStatus[`chainKey:${chainKey}`] = 'ok';
      } catch {
        heads[chainKey] = 0;
        rpcStatus[`chainKey:${chainKey}`] = 'down';
      }
    }

    let chainId = 0;
    try {
      chainId = await publicClient.getChainId();
      rpcStatus.creditcoin = 'ok';
    } catch {
      rpcStatus.creditcoin = 'down';
    }

    const report: HealthReport = {
      prosecutorAddress: address,
      prosecutorBalanceCtc: formatEther(balance),
      attestedHeads: heads,
      cursorLag: {},
      rpcStatus,
      sseClients: bus.subscriberCount,
      chainId,
      ok: balance > 0n && chainId === 102031 && Object.values(rpcStatus).every((s) => s === 'ok'),
    };
    return json({ ...report, queueDepth: queue.depth, submitEnabled: config.submitEnabled });
  });

  /**
   * Prosecute a transaction on demand - the dashboard's "Prosecute" button.
   *
   * `relayed` (default): the worker builds the proof, pays the gas, and takes the bounty.
   * `self`: the worker returns ready-to-sign calldata so the user's own wallet submits it. The
   * verdict is identical either way; only who pays differs.
   */
  app.post('/api/prosecute', async (req, reply) => {
    const body = req.body as {
      txHashes?: string[];
      txHash?: string;
      subjectId?: Hex;
      ruleId?: Hex;
      chainKey?: number;
      mode?: 'relayed' | 'self';
    };

    const txHashes = body.txHashes ?? (body.txHash ? [body.txHash] : []);
    if (txHashes.length === 0) return reply.code(400).send({ error: 'txHash or txHashes required' });
    if (!body.subjectId || !body.ruleId) {
      return reply.code(400).send({ error: 'subjectId and ruleId required' });
    }

    const chainKey = (body.chainKey ?? 3) as ChainKey;
    const candidate = {
      id: `manual-${Date.now()}`,
      subjectId: body.subjectId,
      ruleId: body.ruleId,
      chainKey,
      txHashes: txHashes as Hex[],
      blockHeight: 0,
      state: 'DETECTED' as const,
      attempts: 0,
      createdAt: new Date().toISOString(),
    };

    if ((body.mode ?? 'relayed') === 'self') {
      const bundle = await buildEvidenceBundle(attestcoin, chainKey, txHashes);
      return json({
        mode: 'self',
        input: toEvidenceInput(bundle, body.subjectId, body.ruleId),
        continuityLength: bundle.continuityLength,
        cached: bundle.cached,
      });
    }

    store.upsertCandidate(candidate);
    bus.publish({ type: 'candidate.found', candidate });
    queue.enqueue(candidate);
    return json({ mode: 'relayed', candidateId: candidate.id });
  });

  /** Live narration. The attestation wait is minutes long; silence would read as a hang. */
  app.get('/api/stream', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    reply.raw.write(`: connected\n\n`);

    const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 20_000);
    const unsubscribe = bus.subscribe((event) => {
      reply.raw.write(`data: ${JSON.stringify(json(event))}\n\n`);
    });

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`[api] listening on http://localhost:${config.port}`);
  return app;
}
