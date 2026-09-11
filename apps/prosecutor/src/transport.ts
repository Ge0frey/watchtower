import { fallback, http, type Transport } from 'viem';

/**
 * viem transport across one or more endpoints.
 *
 * The scanners are the part of the system most exposed to someone else's uptime, and a scanner that
 * stalls silently is worse than one that errors. With a fallback configured, viem ranks endpoints by
 * observed latency and error rate and moves traffic away from a degrading one on its own; with a
 * single URL this is an ordinary http transport.
 */
export function rpcTransport(urls: (string | undefined)[]): Transport {
  const present = urls.filter((u): u is string => Boolean(u));
  if (present.length === 0) throw new Error('no RPC URL configured');
  if (present.length === 1) return http(present[0]!, { retryCount: 3, timeout: 15_000 });

  return fallback(
    present.map((url) => http(url, { retryCount: 2, timeout: 12_000 })),
    { rank: { interval: 60_000, sampleCount: 5 } },
  );
}
