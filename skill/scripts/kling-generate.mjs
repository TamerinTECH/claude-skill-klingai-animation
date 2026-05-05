#!/usr/bin/env node

/**
 * Back-compat shim — forwards to generate.mjs with --provider=kling.
 *
 * The original Kling-only entrypoint. Existing callers can keep using this
 * path; new code should call generate.mjs directly and pass --provider=...
 * to choose between the Kling direct API and the Higgsfield CLI.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dispatcher = resolve(__dirname, 'generate.mjs');

const child = spawn(
  process.execPath,
  [dispatcher, '--provider=kling', ...process.argv.slice(2)],
  { stdio: 'inherit' }
);

child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (err) => {
  console.error('Failed to launch dispatcher:', err.message);
  process.exit(1);
});
