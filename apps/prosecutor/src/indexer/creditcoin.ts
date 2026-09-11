import { parseEventLogs, type Address, type Hex, type Log } from 'viem';
import type { Incident } from '@watchtower/shared';
import { underwritingVaultAbi, watchtowerCoreAbi } from '@watchtower/shared';
import { bus } from '../bus.js';
import { contracts, publicClient } from '../chain.js';
import { config } from '../config.js';
import { store } from '../db/store.js';
import { getLogsChunked } from '../rpc.js';

/**
 * Watchtower's own events, mirrored into the worker so the dashboard has history without re-reading
 * the chain for every card.
 *
 * Polls `eth_getLogs` rather than using `watchContractEvent`. Creditcoin's node expires RPC filters
 * aggressively - viem creates one, and within a couple of polls the node answers
 * `eth_getFilterChanges` with "Filter id 1 does not exist", forever. A moving block window has no
 * server-side state to lose, and one poll covers every event instead of five competing watchers.
 *
 * This is presentation state, never truth. Every number that decides money is read straight from
 * Creditcoin by the UI; if the two disagree, the chain wins.
 */
export function startCreditcoinIndexer() {
  const CURSOR_KEY = 'indexer:creditcoin';
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try {
      const head = Number(await publicClient.getBlockNumber());
      const from = store.lastScanned(CURSOR_KEY) ?? head - 1;
      if (head <= from) return;

      // Both contracts in one sweep: the core emits the judgement, the vault emits what it paid.
      const logs = await getLogsChunked(
        publicClient,
        {
          address: [contracts.core.address, contracts.vault.address],
          fromBlock: BigInt(from + 1),
          toBlock: BigInt(head),
        },
        config.logRange,
      );

      if (logs.length > 0) {
        for (const event of parseEventLogs({ abi: watchtowerCoreAbi, logs })) {
          dispatch(event as unknown as AnyLog & { eventName: string });
        }
        for (const event of parseEventLogs({ abi: underwritingVaultAbi, eventName: 'Settled', logs })) {
          onSettled(event as unknown as AnyLog);
        }
      }

      store.setLastScanned(CURSOR_KEY, head);
    } catch (error) {
      console.warn('[indexer] poll failed:', error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  }

  const timer = setInterval(tick, config.indexerPollMs);
  void tick();
  return () => clearInterval(timer);
}

type AnyLog = Log & { args?: Record<string, unknown> };

function dispatch(event: AnyLog & { eventName: string }) {
  switch (event.eventName) {
    case 'VerdictIssued': return onVerdict(event);
    case 'BreachOpened': return onBreach(event);
    case 'GapChallengeUpheld': return onChallenge(event);
    case 'CursorAdvanced': return onCursor(event);
    case 'PriceUpdated': return onPrice(event);
    default: return;
  }
}

/**
 * The vault's own account of a payout: who was paid, and what the prosecutor earned for proving it.
 *
 * The core's `VerdictIssued` says what was owed; only the vault knows what actually moved after
 * cover limits, the per-block cap and the freshness-tiered bounty were applied. The leaderboard is
 * built from this, not from the verdict.
 */
function onSettled(log: AnyLog) {
  const a = log.args ?? {};
  const prosecutor = a.prosecutor as Address;
  const bounty = (a.bounty as bigint) ?? 0n;
  if (prosecutor && prosecutor !== '0x0000000000000000000000000000000000000000') {
    store.creditProsecutor(prosecutor, bounty);
  }

  const id = a.incidentId as Hex;
  const existing = store.incident(id);
  if (existing) {
    store.upsertIncident({ ...existing, paid: (a.paid as bigint) ?? existing.paid, prosecutor });
  }
  console.log(`[indexer] settled ${id.slice(0, 10)} paid ${a.paid} wei, bounty ${bounty} wei`);
}

function onVerdict(log: AnyLog) {
  const a = log.args ?? {};
  const id = a.incidentId as Hex;
  const existing = store.incident(id);
  const incident: Incident = {
    id,
    subjectId: a.subjectId as Hex,
    ruleId: a.ruleId as Hex,
    prosecutor: (existing?.prosecutor ?? '0x0000000000000000000000000000000000000000') as Address,
    beneficiary: a.beneficiary as Address,
    damagesUsd: (a.damagesUsd as bigint) ?? 0n,
    paid: (a.paid as bigint) ?? 0n,
    status: 'settled',
    challengeDeadline: 0,
    continuityLength: existing?.continuityLength ?? 0,
    evidence: existing?.evidence ?? [],
    creditcoinTxHash: log.transactionHash ?? undefined,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
  store.upsertIncident(incident);
  bus.publish({ type: 'verdict.issued', incident });
  console.log(`[indexer] verdict ${id.slice(0, 10)} paid ${incident.paid} wei`);
}

function onBreach(log: AnyLog) {
  const a = log.args ?? {};
  const id = a.incidentId as Hex;
  const incident: Incident = {
    id,
    subjectId: a.subjectId as Hex,
    ruleId: store.incident(id)?.ruleId ?? ('0x' as Hex),
    prosecutor: a.prosecutor as Address,
    beneficiary: '0x0000000000000000000000000000000000000000' as Address,
    damagesUsd: (a.damagesUsd as bigint) ?? 0n,
    paid: 0n,
    status: 'open',
    challengeDeadline: Number((a.challengeDeadline as bigint) ?? 0n),
    continuityLength: 0,
    evidence: store.incident(id)?.evidence ?? [],
    creditcoinTxHash: log.transactionHash ?? undefined,
    createdAt: new Date().toISOString(),
  };
  store.upsertIncident(incident);
  bus.publish({ type: 'breach.opened', incident });
  console.log(`[indexer] breach opened ${id.slice(0, 10)} - challengeable until ${incident.challengeDeadline}`);
}

function onChallenge(log: AnyLog) {
  const a = log.args ?? {};
  const id = a.incidentId as Hex;
  const existing = store.incident(id);
  if (existing) store.upsertIncident({ ...existing, status: 'rolled-back' });
  bus.publish({ type: 'challenge.upheld', incidentId: id, challenger: a.challenger as Address });
  console.log(`[indexer] gap challenge upheld on ${id.slice(0, 10)} - accumulator rolled back`);
}

function onCursor(log: AnyLog) {
  const a = log.args ?? {};
  bus.publish({
    type: 'cursor.advanced',
    subjectId: a.subjectId as Hex,
    height: Number((a.height as bigint) ?? 0n),
    index: Number((a.index as number) ?? 0),
  });
}

function onPrice(log: AnyLog) {
  const a = log.args ?? {};
  const answer = (a.answer as bigint) ?? 0n;
  bus.publish({
    type: 'price.updated',
    subjectId: a.subjectId as Hex,
    answer: String(answer),
    provenAtHeight: Number((a.provenAtHeight as bigint) ?? 0n),
  });
  console.log(`[indexer] price proven $${(Number(answer) / 1e8).toFixed(2)} at mainnet block ${a.provenAtHeight}`);
}
