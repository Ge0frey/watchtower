'use client';

import { useEffect, useRef, useState } from 'react';
import type { Candidate, Incident, StreamEvent } from '@watchtower/shared';
import { api } from '@/lib/api';

export interface FeedState {
  incidents: Incident[];
  candidates: Candidate[];
  /** What the pipeline is doing right now, keyed by candidate - this is what removes the dead air. */
  progress: Record<string, string>;
  connected: boolean;
}

/**
 * History over REST, live changes over SSE.
 *
 * The attestation wait is the slow step - roughly eight minutes end to end - so every stage of the
 * pipeline is narrated rather than hidden behind a spinner.
 */
export function useIncidentFeed(): FeedState {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [connected, setConnected] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    void Promise.all([api.incidents(), api.candidates()])
      .then(([i, c]) => {
        if (!mounted.current) return;
        setIncidents(i);
        setCandidates(c);
        setConnected(true);
      })
      .catch(() => setConnected(false));

    const close = api.stream((event: StreamEvent) => {
      if (!mounted.current) return;
      switch (event.type) {
        case 'candidate.found':
          setCandidates((prev) => [event.candidate, ...prev.filter((c) => c.id !== event.candidate.id)]);
          setProgress((p) => ({ ...p, [event.candidate.id]: 'detected' }));
          break;
        case 'proof.waiting':
          setProgress((p) => ({
            ...p,
            [event.candidateId]: `waiting for attestation of block ${event.blockHeight.toLocaleString()}`,
          }));
          break;
        case 'proof.building':
          setProgress((p) => ({ ...p, [event.candidateId]: 'building Merkle + continuity proofs' }));
          break;
        case 'proof.ready':
          setProgress((p) => ({
            ...p,
            [event.candidateId]: `proof ready · ${event.continuityLength} continuity roots${event.cached ? ' (cached)' : ''}`,
          }));
          break;
        case 'evidence.submitted':
          setProgress((p) => ({ ...p, [event.candidateId]: 'verifying on Creditcoin' }));
          break;
        case 'verdict.issued':
        case 'breach.opened':
          setIncidents((prev) => [event.incident, ...prev.filter((i) => i.id !== event.incident.id)]);
          break;
        case 'challenge.upheld':
          setIncidents((prev) =>
            prev.map((i) => (i.id === event.incidentId ? { ...i, status: 'rolled-back' } : i)),
          );
          break;
        case 'error':
          if (event.candidateId) {
            setProgress((p) => ({ ...p, [event.candidateId!]: `failed: ${event.message}` }));
          }
          break;
        default:
          break;
      }
    });

    return () => {
      mounted.current = false;
      close();
    };
  }, []);

  return { incidents, candidates, progress, connected };
}
