import { EventEmitter } from 'node:events';
import type { StreamEvent } from '@watchtower/shared';

/**
 * One in-process channel from the pipeline to every connected dashboard.
 *
 * The four-second silences while `waitUntilHeightAttested` polls are dead air unless the UI is
 * narrating them, so the pipeline publishes each step rather than only the outcome.
 */
class Bus extends EventEmitter {
  publish(event: StreamEvent) {
    this.emit('event', event);
  }

  subscribe(listener: (event: StreamEvent) => void) {
    this.on('event', listener);
    return () => this.off('event', listener);
  }

  get subscriberCount() {
    return this.listenerCount('event');
  }
}

export const bus = new Bus();
bus.setMaxListeners(0);
