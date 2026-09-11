'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * Is the prosecutor worker reachable?
 *
 * Shares the `['health']` query key with the header, so asking in several places costs one request.
 *
 * This matters more than it looks: without the worker the incident feed is simply empty, which is
 * indistinguishable from "nothing has ever happened". Everything the chain knows still renders, so a
 * silent empty list is the wrong story to tell.
 */
export function useWorkerStatus() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 15_000,
    retry: false,
  });

  return {
    online: health.isSuccess,
    offline: health.isError,
    checking: health.isLoading,
    health: health.data,
  };
}
