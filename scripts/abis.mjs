/**
 * Regenerate packages/shared/src/abis from the compiled contracts.
 *
 *   pnpm abis
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const NAMES = ['WatchtowerCore', 'SubjectRegistry', 'UnderwritingVault', 'IConservationRule', 'DemoBridge'];
const OUT = resolve(process.cwd(), 'packages/shared/src/abis');
const FORGE = process.env.FORGE_BIN ?? `${process.env.HOME}/.foundry/bin/forge`;

mkdirSync(OUT, { recursive: true });

const index = [];
for (const name of NAMES) {
  const abi = execFileSync(FORGE, ['inspect', name, 'abi', '--json'], {
    cwd: resolve(process.cwd(), 'contracts'),
    encoding: 'utf8',
  });
  const varName = `${name.charAt(0).toLowerCase()}${name.slice(1)}Abi`;
  writeFileSync(
    resolve(OUT, `${name}.ts`),
    `// Generated from contracts/out by \`pnpm abis\`. Do not edit by hand.\nexport const ${varName} = ${JSON.stringify(JSON.parse(abi), null, 2)} as const;\n`,
  );
  index.push(`export { ${varName} } from "./${name}";`);
}

writeFileSync(resolve(OUT, 'index.ts'), `// Generated. Do not edit by hand.\n${index.join('\n')}\n`);
console.log(`wrote ${NAMES.length} ABIs to packages/shared/src/abis`);
