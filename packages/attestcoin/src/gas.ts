import type { Contract, JsonRpcApiProvider } from 'ethers';
import { utils } from '@gluwa/usc-sdk';

/** Creditcoin's block gas cap, as the SDK reports it (75,000,000). */
export const MAX_GAS_CAP = utils.gas.MAX_GAS_CAP;

/** Express a receipt's gasUsed as a percentage of a Creditcoin block. */
export const gasAsPercentageOfMax = utils.gas.gasAsPercentageOfMax;

/**
 * Never call `estimateGas` directly on a path that touches the Block Prover Precompile.
 *
 * `pallet-evm` does not reliably propagate revert reasons in estimation mode, so estimation fails on
 * calls that would have succeeded. The SDK ships the workaround and we use it rather than reinventing
 * it: on success it applies a 35% buffer; on failure it falls back to a heuristic derived from the
 * continuity proof length, which is the real cost driver.
 */
export async function gasLimitFor(
  provider: JsonRpcApiProvider,
  contract: Contract,
  calldata: string,
  from: string,
  continuityLength: number,
): Promise<bigint> {
  return utils.gas.computeGasLimit(provider, contract, calldata, from, continuityLength);
}
