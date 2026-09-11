import type { Candidate, HealthReport, Incident, StreamEvent } from '@watchtower/shared';

const BASE = process.env.NEXT_PUBLIC_WORKER_API_URL ?? 'http://localhost:8080';

/**
 * The worker API carries history and enrichment only.
 *
 * Anything that decides money - reserves, cover, vault balances, the proven head - is read straight
 * from Creditcoin by `useChainState`. If the two ever disagree, the chain wins.
 */
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export interface SubjectRow {
  id: `0x${string}`;
  label: string;
  kind: number;
  chainKey: number;
  sourceContract: `0x${string}`;
  rule: string;
  ruleId: `0x${string}`;
  active: boolean;
  payoutCapPerBlock: string;
  priceSubject: `0x${string}`;
  state: { locked: string; minted: string; price: string; cursorHeight: string; cursorIndex: number };
  tranche: { staked: string; premiums: string; paidOut: string };
  bountyPool: string;
}

export const api = {
  subjects: () => get<SubjectRow[]>('/api/subjects'),
  incidents: (limit = 50) => get<Incident[]>(`/api/incidents?limit=${limit}`),
  candidates: () => get<Candidate[]>('/api/candidates'),
  leaderboard: () => get<{ address: string; submissions: number; bountiesWei: string }[]>('/api/leaderboard'),
  health: () => get<HealthReport & { queueDepth: number; submitEnabled: boolean }>('/api/health'),

  prosecute: async (body: {
    txHashes: string[];
    subjectId: string;
    ruleId: string;
    chainKey: number;
    mode?: 'relayed' | 'self';
  }) => {
    const res = await fetch(`${BASE}/api/prosecute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
    return res.json();
  },

  /** Live narration: the attestation wait runs to minutes, and silence would read as a hang. */
  stream(onEvent: (event: StreamEvent) => void): () => void {
    const source = new EventSource(`${BASE}/api/stream`);
    source.onmessage = (message) => {
      try {
        onEvent(JSON.parse(message.data) as StreamEvent);
      } catch {
        /* ignore malformed frames */
      }
    };
    return () => source.close();
  },
};
