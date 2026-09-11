import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Load the monorepo's single `.env` before Next inlines anything.
 *
 * Next only reads `.env` from the app directory, but Watchtower keeps one env file
 * at the repo root — it is what the contracts, the deploy scripts and the worker
 * all read, and the deploy script writes the deployed addresses straight back into
 * it. Without this the browser bundle ships with no contract addresses at all and
 * the entire dashboard renders "no deployment configured" against a chain that is
 * plainly live.
 *
 * Passed through Next's own `env` key rather than by mutating `process.env`: the
 * build has already decided which variables to inline by the time this module's
 * side effects would run, so an assignment there is silently ignored.
 *
 * Only `NEXT_PUBLIC_*` keys are forwarded. The same file holds three private keys,
 * so this is an allowlist by prefix, never a filter of things to exclude.
 */
function rootPublicEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = resolve(here, '../../.env');

  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return {}; // no root .env — hosted builds supply their own environment
  }

  const out = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

    const i = trimmed.indexOf('=');
    const key = trimmed.slice(0, i).trim();
    // Only the browser-safe half of the file. Private keys live in the same file and
    // must never reach a bundle, so this is an allowlist by prefix, not a filter.
    if (!key.startsWith('NEXT_PUBLIC_')) continue;

    // Strip an inline `# comment` and surrounding quotes, matching how dotenv and
    // Foundry's dotenvy parse the same file.
    const value = trimmed
      .slice(i + 1)
      .replace(/\s+#.*$/, '')
      .trim()
      .replace(/^["']|["']$/g, '');

    // A real environment variable always wins, so a deployment platform's own
    // configuration is never overwritten by a stray local file.
    if (process.env[key] === undefined && value) out[key] = value;
  }
  return out;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@watchtower/shared'],
  env: rootPublicEnv(),
};

export default nextConfig;
