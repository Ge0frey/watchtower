import type { GetLogsParameters, Log, PublicClient } from 'viem';

/** A mined log: `pending = false`, so blockNumber, transactionHash and transactionIndex are non-null. */
export type MinedLog = Log<bigint, number, false>;

/**
 * `eth_getLogs` in slices the provider will actually accept.
 *
 * Alchemy's free tier caps a single `getLogs` at a **10 block range** and rejects anything wider
 * outright, which is not a rate limit you can wait out. Public fallbacks allow far more, but the
 * chunk size has to suit the strictest endpoint in the pool, so it is configurable and defaults to 10.
 *
 * Slices are fetched in order and concatenated, so callers still see one ordered log array. Pending
 * logs are dropped - the scanners only ever query finalised ranges, and a pending log has no
 * coordinate to prove.
 */
export async function getLogsChunked(
  client: PublicClient,
  params: Omit<GetLogsParameters, 'fromBlock' | 'toBlock'> & { fromBlock: bigint; toBlock: bigint },
  maxRange: number,
): Promise<MinedLog[]> {
  const span = BigInt(Math.max(1, maxRange));
  const out: MinedLog[] = [];

  for (let from = params.fromBlock; from <= params.toBlock; from += span) {
    const to = from + span - 1n > params.toBlock ? params.toBlock : from + span - 1n;
    const slice = (await client.getLogs({ ...params, fromBlock: from, toBlock: to } as GetLogsParameters)) as Log[];
    for (const log of slice) {
      if (log.blockNumber !== null && log.transactionHash !== null && log.transactionIndex !== null) {
        out.push(log as MinedLog);
      }
    }
  }

  return out;
}
