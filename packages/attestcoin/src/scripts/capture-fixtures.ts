/**
 * Capture real proof bundles from CC3 Testnet into JSON, so Solidity tests exercise genuine
 * `encodedTransaction` bytes - real Uniswap `Swap` logs, real receipts - instead of a stub.
 *
 *   pnpm capture 0xHASH [0xHASH ...]   ->  fixtures/<name>.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '../client.js';
import { buildEvidenceBundle } from '../proofs.js';

async function main() {
  const name = process.env.FIXTURE_NAME ?? 'bundle';
  const chainKey = (process.env.THESIS_CHAIN_KEY ? Number(process.env.THESIS_CHAIN_KEY) : 3) as 1 | 3;
  const hashes = process.argv.slice(2).filter((a) => a.startsWith('0x'));
  if (hashes.length === 0) throw new Error('usage: pnpm capture <txHash> [txHash ...]');

  const client = createClient();
  const bundle = await buildEvidenceBundle(client, chainKey, hashes, {
    waiting: (h) => console.log(`waiting for attestation of block ${h}`),
  });

  const dir = resolve(process.cwd(), '../../fixtures');
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, `${name}.json`);
  // Written for `contracts/test/unit/FixtureReplay.t.sol`, whose JSON reader is Foundry's.
  //  - `rowCount`, because a one-element `$.rows[*].field` result collapses to a scalar and a
  //    Solidity replay cannot then learn the length from the array itself;
  //  - flat `siblingHashes` / `siblingIsLeft` columns, because a `[*]` projection across an array of
  //    objects is not a single JSON value and the array cheatcodes reject it.
  // The nested `siblings` stay for humans and for the TypeScript path.
  const forSolidity = bundle.rows.map((row) => ({
    ...row,
    siblingHashes: row.siblings.map((s) => s.hash),
    siblingIsLeft: row.siblings.map((s) => s.isLeft),
  }));

  writeFileSync(
    path,
    JSON.stringify(
      { capturedAt: new Date().toISOString(), rowCount: bundle.rows.length, ...bundle, rows: forSolidity },
      null,
      2,
    ),
  );
  console.log(`wrote ${path} (${bundle.rows.length} rows, continuity ${bundle.continuityLength})`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
