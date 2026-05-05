#!/usr/bin/env node

/**
 * Animate Character — Provider Dispatcher
 *
 * Routes image-to-video generation to one of two providers:
 *   --provider=kling        Direct Kling AI API (JWT auth, KLING_*_KEY env vars)
 *   --provider=higgsfield   Higgsfield CLI (auth via `higgsfield auth login`)
 *
 * If --provider is omitted, auto-detects:
 *   1. KLING_ACCESS_KEY + KLING_SECRET_KEY set → kling
 *   2. higgsfield CLI on PATH and authenticated → higgsfield
 *   3. Otherwise: error with setup hints
 *
 * All other arguments (--image, --prompt, --duration, --output, etc.) are
 * forwarded to the chosen provider script unchanged.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROVIDERS = {
  kling: resolve(__dirname, 'providers', 'kling-direct.mjs'),
  higgsfield: resolve(__dirname, 'providers', 'higgsfield-cli.mjs')
};

function findProviderArg(argv) {
  // Look for --provider=value or --provider value
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const match = arg.match(/^--provider=(.+)$/);
    if (match) return { provider: match[1], stripIndex: i, stripCount: 1 };
    if (arg === '--provider' && i + 1 < argv.length) {
      return { provider: argv[i + 1], stripIndex: i, stripCount: 2 };
    }
  }
  return null;
}

function hasKlingEnv() {
  return Boolean(process.env.KLING_ACCESS_KEY && process.env.KLING_SECRET_KEY);
}

function hasHiggsfieldCli() {
  try {
    const result = spawnSync(
      process.platform === 'win32' ? 'where' : 'which',
      ['higgsfield'],
      { encoding: 'utf8' }
    );
    if (result.status !== 0) return false;
    // Verify auth is set up — `higgsfield model list --json` requires auth
    const auth = spawnSync('higgsfield', ['model', 'list', '--json'], {
      encoding: 'utf8',
      timeout: 10_000,
      shell: process.platform === 'win32'
    });
    return auth.status === 0;
  } catch {
    return false;
  }
}

function autoDetectProvider() {
  if (hasKlingEnv()) return 'kling';
  if (hasHiggsfieldCli()) return 'higgsfield';
  return null;
}

function printSetupHelp() {
  console.error('No provider configured. Set up one of:');
  console.error('');
  console.error('  Option A — Kling AI direct (JWT auth):');
  console.error('    Set KLING_ACCESS_KEY and KLING_SECRET_KEY env vars.');
  console.error('    Get keys at https://app.klingai.com/global/dev');
  console.error('');
  console.error('  Option B — Higgsfield CLI (Kling 3.0 + 15 other models):');
  console.error('    Install: npm install -g @higgsfield-ai/cli');
  console.error('    Login:   higgsfield auth login');
  console.error('    See:     https://github.com/higgsfield-ai/skills');
  console.error('');
  console.error('Then re-run, optionally with --provider=kling or --provider=higgsfield.');
}

function main() {
  const argv = process.argv.slice(2);

  let provider;
  let forwardArgs = argv.slice();

  const found = findProviderArg(argv);
  if (found) {
    provider = found.provider;
    forwardArgs.splice(found.stripIndex, found.stripCount);
  } else {
    provider = autoDetectProvider();
    if (!provider) {
      printSetupHelp();
      process.exit(1);
    }
    console.error(`[dispatcher] Auto-detected provider: ${provider}`);
  }

  if (!PROVIDERS[provider]) {
    console.error(`Unknown provider: "${provider}". Valid: ${Object.keys(PROVIDERS).join(', ')}`);
    process.exit(1);
  }

  const scriptPath = PROVIDERS[provider];
  if (!existsSync(scriptPath)) {
    console.error(`Provider script missing: ${scriptPath}`);
    process.exit(1);
  }

  const child = spawn(process.execPath, [scriptPath, ...forwardArgs], {
    stdio: 'inherit'
  });

  child.on('exit', (code) => process.exit(code ?? 1));
  child.on('error', (err) => {
    console.error('Failed to launch provider:', err.message);
    process.exit(1);
  });
}

main();
