import type { Candidate } from '@watchtower/shared';
import { bus } from '../bus.js';
import { config } from '../config.js';
import { store } from '../db/store.js';
import { isPermanent } from './replay.js';
import { backoffMs, prosecute } from './submit.js';

/**
 * A single-flight queue in front of the prosecutor's hot key.
 *
 * Nonce management is the reason: two scanners racing to submit would collide, and every failed
 * submission is real CTC. One worker at a time, retried with backoff, replayed after a restart.
 */
class Queue {
  private running = false;
  private readonly pending: { candidate: Candidate; valueWei: bigint }[] = [];

  enqueue(candidate: Candidate, valueWei = 0n) {
    if (this.pending.some((p) => p.candidate.id === candidate.id)) return;
    this.pending.push({ candidate, valueWei });
    void this.drain();
  }

  get depth() {
    return this.pending.length;
  }

  private async drain() {
    if (this.running) return;
    this.running = true;

    while (this.pending.length > 0) {
      const job = this.pending.shift()!;
      try {
        const result = await prosecute(job.candidate, job.valueWei);
        console.log(
          `[queue] ${job.candidate.id} settled in ${result.txHash} ` +
            `(gas ${result.gasUsed}, ${result.gasPercentOfBlock.toFixed(2)}% of a Creditcoin block)`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const current = store.candidate(job.candidate.id);
        const attempts = current?.attempts ?? 0;

        // Attempts are for failures that might go the other way next time. A spent window or a
        // retired subject never will, and retrying one costs a full submission's gas per attempt.
        const permanent = await isPermanent(job.candidate, error);

        if (permanent || attempts >= config.maxAttempts) {
          store.setCandidateState(job.candidate.id, 'UNPROVABLE', message);
          bus.publish({ type: 'error', candidateId: job.candidate.id, message });
          console.error(
            permanent
              ? `[queue] ${job.candidate.id} cannot succeed, not retrying: ${message}`
              : `[queue] ${job.candidate.id} gave up after ${attempts} attempts: ${message}`,
          );
        } else {
          store.setCandidateState(job.candidate.id, 'FAILED', message);
          const delay = backoffMs(attempts);
          // The store has already announced FAILED. This repeats it with the one thing only the
          // queue knows, so the card counts down to the next attempt instead of going quiet.
          bus.publish({
            type: 'candidate.state',
            candidateId: job.candidate.id,
            state: 'FAILED',
            attempts: store.candidate(job.candidate.id)?.attempts ?? attempts + 1,
            message,
            retryInMs: delay,
          });
          console.warn(`[queue] ${job.candidate.id} failed (${message}); retrying in ${delay}ms`);
          setTimeout(() => this.enqueue(job.candidate, job.valueWei), delay);
        }
      }
    }

    this.running = false;
  }
}

export const queue = new Queue();

/** Replay anything that was in flight when the worker stopped. */
export function resumePending() {
  const pending = store.resumable();
  if (pending.length === 0) return;
  console.log(`[queue] resuming ${pending.length} candidate(s) left over from the last run`);
  for (const candidate of pending) queue.enqueue(candidate);
}
