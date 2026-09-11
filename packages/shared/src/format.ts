import { formatEther } from 'viem';

/** USD with 8 decimals - the unit every rule judges damages in. */
export function formatUsd(usdE8: bigint): string {
  const dollars = Number(usdE8) / 1e8;
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: dollars < 100 ? 2 : 0,
  });
}

export function formatCtc(wei: bigint, decimals = 3): string {
  const value = Number(formatEther(wei));
  return `${value.toLocaleString('en-US', { maximumFractionDigits: decimals })} CTC`;
}

export function shortHash(value: string, lead = 6, tail = 4): string {
  if (value.length <= lead + tail + 2) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

/** `21,340,118 · 47` - the coordinate, rendered the way the block strip labels it. */
export function formatCoord(blockHeight: number, txIndex: number): string {
  return `${blockHeight.toLocaleString('en-US')} · ${txIndex}`;
}

/**
 * Continuity length is the protocol's own cost driver, so it is also how Watchtower prices freshness.
 * Fresh evidence sits a few blocks from a live attestation; past the 24-hour checkpoint cliff a proof
 * needs ~1000 hashes and costs roughly ten times as much gas.
 */
export function freshnessLabel(continuityLength: number): 'fresh' | 'aging' | 'stale' {
  if (continuityLength <= 100) return 'fresh';
  if (continuityLength <= 900) return 'aging';
  return 'stale';
}

/** Mirrors UnderwritingVault.bountyFor's multiplier, for display only. */
export function bountyMultiplier(continuityLength: number): number {
  const label = freshnessLabel(continuityLength);
  return label === 'fresh' ? 1 : label === 'aging' ? 0.5 : 0.2;
}
