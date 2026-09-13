import Fastify from 'fastify';
import cors from '@fastify/cors';
import { formatEther, type Address, type Hex } from 'viem';
import { attestedHead, createClient, toEvidenceInput, buildEvidenceBundle } from '@watchtower/attestcoin';
import { RULES, ruleByIdOrNull, type ChainKey, type HealthReport } from '@watchtower/shared';
import { bus } from '../bus.js';
import { config } from '../config.js';
import { contracts, publicClient, readBountyPool, readSubjects, readVaultTranche, prosecutorWallet } from '../chain.js';
import { store } from '../db/store.js';
import { queue } from '../pipeline/queue.js';
import { consumedMessage, coordinatesOf, firstConsumed } from '../pipeline/replay.js';

const attestcoin = createClient();

/** BigInt does not survive JSON.stringify; every numeric leaves as a decimal string. */
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));

/**
 * How far behind the attested head each stream subject's proven cursor sits, in source-chain blocks.
 *
 * This is the number that says whether the system is keeping up. The demo checklist gates on it, and
 * it is the difference between "nothing has happened lately" and "the prosecutor stopped working an
 * hour ago" - two states that look identical on a dashboard showing only the latest verdict.
 *
 * Intra-block subjects have no cursor (they read a neighbourhood, not a stream) and are skipped.
 */
async function cursorLag(heads: Record<number, number>): Promise<Record<string, number>> {
  try {
    const subjects = await readSubjects();
    const lag: Record<string, number> = {};
    for (const s of subjects) {
      const cursor = Number(s.state.cursorHeight);
      if (cursor === 0) continue;
      const head = heads[Number(s.subject.chainKey)] ?? 0;
      if (head === 0) continue;
      lag[s.subject.label] = Math.max(0, head - cursor);
    }
    return lag;
  } catch {
    return {};
  }
}

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

  /**
   * The pre-flight check, as an endpoint.
   *
   * Everything here degrades rather than throws. A worker with no hot key is a perfectly valid
   * read-only deployment, and a health endpoint that 500s because one field is unavailable tells the
   * dashboard the worker is dead when it is merely unfunded - which is the opposite of the truth it
   * exists to report.
   */
  app.get('/api/health', async () => {
    let address = '0x0000000000000000000000000000000000000000' as Address;
    let balance = 0n;
    let keyed = false;
    try {
      address = (await prosecutorWallet().getAddress()) as Address;
      balance = await publicClient.getBalance({ address });
      keyed = true;
    } catch {
      keyed = false; // no PROSECUTOR_PK, or the RPC is down - both reported, neither fatal
    }

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
      cursorLag: await cursorLag(heads),
      rpcStatus,
      sseClients: bus.subscriberCount,
      chainId,
      ok:
        keyed &&
        balance > 0n &&
        chainId === 102031 &&
        Object.values(rpcStatus).every((s) => s === 'ok'),
    };
    return json({
      ...report,
      queueDepth: queue.depth,
      submitEnabled: config.submitEnabled,
      prosecutorKeyed: keyed,
    });
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

    /*
     * Refuse what cannot settle, before anything is queued or signed.
     *
     * All three of these end in the same on-chain revert, and the cost of finding out that way is a
     * submission's gas per retry for the relayed path and a rejected wallet transaction for the
     * self path. None of them is visible to `preflight`, which re-verifies proofs and nothing else.
     * A 4xx here is the whole difference between an answer and a pipeline card that fails quietly.
     */
    const duplicate = store
      .candidates((c) => !['CONFIRMED', 'UNPROVABLE'].includes(c.state))
      .find((c) => c.txHashes.join('|').toLowerCase() === txHashes.join('|').toLowerCase());
    if (duplicate) {
      return reply
        .code(409)
        .send({ error: `already in flight as ${duplicate.id} (${duplicate.state.toLowerCase()})` });
    }

    let coords;
    try {
      coords = await coordinatesOf(chainKey, txHashes);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'evidence is not mined' });
    }

    const subject = await publicClient.readContract({
      ...contracts.registry,
      functionName: 'getSubject',
      args: [body.subjectId],
    });
    if (!subject.active) {
      return reply.code(400).send({ error: `subject ${subject.label} is retired - submitEvidence would revert` });
    }

    const spent = await firstConsumed(body.ruleId, body.subjectId, chainKey, coords);
    if (spent) {
      return reply.code(409).send({ error: consumedMessage(body.ruleId, body.subjectId, coords, spent) });
    }

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
