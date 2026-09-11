import type { Candidate } from '@watchtower/shared';
import { bus } from '../bus.js';
import { config } from '../config.js';
import { store } from '../db/store.js';
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

        if (attempts >= config.maxAttempts) {
          store.setCandidateState(job.candidate.id, 'UNPROVABLE', message);
          bus.publish({ type: 'error', candidateId: job.candidate.id, message });
          console.error(`[queue] ${job.candidate.id} gave up after ${attempts} attempts: ${message}`);
        } else {
          store.setCandidateState(job.candidate.id, 'FAILED', message);
          const delay = backoffMs(attempts);
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
