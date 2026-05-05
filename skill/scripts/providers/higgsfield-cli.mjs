#!/usr/bin/env node

/**
 * Higgsfield CLI Image-to-Video Provider
 *
 * Wraps `higgsfield generate create <model> ... --wait --json`, parses the
 * resulting job JSON, and downloads the produced MP4 to --output.
 *
 * Auth is handled by the higgsfield CLI itself (run `higgsfield auth login`
 * once before using). No env vars required.
 *
 * Usage:
 *   node higgsfield-cli.mjs \
 *     --image=./character.png \
 *     --prompt="A panda bouncing happily on green background" \
 *     --duration=5 \
 *     --output=./output/animation.mp4
 *
 * Higgsfield-specific options:
 *   --hf-model=<job_set_type>   default: read from higgsfield-unlimited.json
 *                               (default_video field). Falls back to kling3_0
 *                               if the config file is missing.
 *
 *                               Other options: seedance_2_0, veo3_1, kling2_6,
 *                               wan2_7, minimax_hailuo, etc.
 *                               Run `higgsfield model list --json` to see all.
 *
 * The script reads ./higgsfield-unlimited.json (next to this file) for the
 * user's unlimited-plan model list. When the chosen model is in that list,
 * `extra_params` are auto-appended (e.g. minimax_hailuo gets --model=minimax-2.3)
 * and --duration is snapped to the nearest model-valid value if needed.
 * Update higgsfield-unlimited.json when your subscription changes.
 */

import { spawn } from 'node:child_process';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UNLIMITED_CONFIG_PATH = resolve(__dirname, 'higgsfield-unlimited.json');

function parseArgs(argv) {
  const args = {};
  for (const arg of argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) {
      args[match[1]] = match[2];
    } else if (arg.startsWith('--')) {
      args[arg.slice(2)] = true;
    }
  }
  return args;
}

async function loadUnlimitedConfig() {
  try {
    const text = await readFile(UNLIMITED_CONFIG_PATH, 'utf8');
    return JSON.parse(text);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    console.error(`Warning: failed to read ${UNLIMITED_CONFIG_PATH}: ${err.message}`);
    return null;
  }
}

function nearestDuration(requested, validValues) {
  if (!validValues || !validValues.length) return String(requested);
  const reqStr = String(requested);
  if (validValues.includes(reqStr)) return reqStr;
  const req = Number(requested);
  return validValues.reduce((best, cur) =>
    Math.abs(Number(cur) - req) < Math.abs(Number(best) - req) ? cur : best
  );
}

const args = parseArgs(process.argv);

const IMAGE_PATH = args['image'];
const PROMPT = args['prompt'] || '';
const REQUESTED_DURATION = args['duration'] || '5';
const MODE = args['mode'] || 'std';
const ASPECT_RATIO = args['aspect-ratio'] || '1:1';
const OUTPUT = args['output'] || './animation.mp4';
const EXPLICIT_HF_MODEL = args['hf-model'];
const WAIT_TIMEOUT = args['wait-timeout'] || '20m';

function runHiggsfield(cliArgs) {
  return new Promise((resolvePromise, rejectPromise) => {
    // Use the .cmd shim on Windows with shell:false so spawn doesn't re-parse
    // the prompt args through cmd.exe (which would split on every space and
    // produce "Too many positional args" from the higgsfield CLI).
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'higgsfield.cmd' : 'higgsfield';
    const child = spawn(cmd, cliArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stderr.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        rejectPromise(new Error(
          'higgsfield CLI not found in PATH. Install it with `npm install -g @higgsfield-ai/cli` ' +
          'or see https://github.com/higgsfield-ai/skills, then run `higgsfield auth login`.'
        ));
      } else {
        rejectPromise(err);
      }
    });

    child.on('close', (code) => {
      if (code !== 0) {
        rejectPromise(new Error(`higgsfield CLI exited with code ${code}\n${stderr}`));
      } else {
        resolvePromise({ stdout, stderr });
      }
    });
  });
}

function extractVideoUrl(jobJson) {
  // The CLI returns a job object (or array of jobs) when --json is set.
  // Result URL location varies by shape, so probe several known paths.
  const jobs = Array.isArray(jobJson) ? jobJson : [jobJson];

  for (const job of jobs) {
    if (!job || typeof job !== 'object') continue;

    const candidates = [
      job.video_url,
      job.media_url,
      job.url,
      job.output_url,
      job.result?.url,
      job.result?.video_url,
      job.result?.media_url,
      job.results?.[0]?.url,
      job.results?.[0]?.video_url,
      job.outputs?.[0]?.url,
      job.outputs?.[0]?.video_url,
      job.media?.[0]?.url,
      job.media?.[0]?.video_url,
      ...(Array.isArray(job.jobs) ? job.jobs.flatMap(j => [
        j.video_url, j.media_url, j.url, j.result?.url, j.result?.video_url,
        j.results?.[0]?.url, j.outputs?.[0]?.url
      ]) : [])
    ];

    for (const url of candidates) {
      if (typeof url === 'string' && /^https?:\/\//.test(url) &&
          (url.includes('.mp4') || url.includes('video') || url.includes('media'))) {
        return url;
      }
    }
  }

  return null;
}

async function downloadFile(url, outputPath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buffer);
}

async function main() {
  if (!IMAGE_PATH) {
    console.error('Error: --image=<path> is required.');
    process.exit(1);
  }

  // Resolve which model to use:
  //   1. --hf-model=... explicit override (no unlimited check)
  //   2. else default_video from higgsfield-unlimited.json
  //   3. else hardcoded fallback (kling3_0)
  const unlimitedConfig = await loadUnlimitedConfig();
  const HF_MODEL = EXPLICIT_HF_MODEL
    || unlimitedConfig?.default_video
    || 'kling3_0';

  // Look up model entry in unlimited list (for extra_params + valid_durations).
  const unlimitedEntry = unlimitedConfig?.video?.find(m => m.job_set_type === HF_MODEL);
  const isUnlimited = Boolean(unlimitedEntry);
  const validDurations = unlimitedEntry?.valid_durations;
  const DURATION = validDurations
    ? nearestDuration(REQUESTED_DURATION, validDurations)
    : String(REQUESTED_DURATION);

  console.log('=== Higgsfield CLI Image-to-Video ===');
  console.log(`Image: ${IMAGE_PATH}`);
  console.log(`Prompt: ${PROMPT}`);
  console.log(`Model: ${HF_MODEL}${isUnlimited ? ' [UNLIMITED on your plan]' : ''}`);
  if (DURATION !== String(REQUESTED_DURATION)) {
    console.log(`Duration: ${DURATION}s (snapped from ${REQUESTED_DURATION}s; ${HF_MODEL} accepts ${validDurations.join(', ')})`);
  } else {
    console.log(`Duration: ${DURATION}s`);
  }
  console.log(`Mode: ${MODE} | Aspect: ${ASPECT_RATIO}`);
  console.log(`Output: ${OUTPUT}`);
  if (!EXPLICIT_HF_MODEL && unlimitedConfig?.default_video === HF_MODEL) {
    console.log(`(Default from higgsfield-unlimited.json — pass --hf-model=... to override)`);
  }
  console.log('');

  const cliArgs = [
    'generate', 'create', HF_MODEL,
    '--prompt', PROMPT,
    '--start-image', resolve(IMAGE_PATH),
    '--duration', DURATION,
    '--aspect_ratio', ASPECT_RATIO,
    '--wait',
    '--wait-timeout', WAIT_TIMEOUT,
    '--json'
  ];

  // Mode flag is Kling-specific; only pass it for Kling models.
  if (HF_MODEL.startsWith('kling')) {
    cliArgs.push('--mode', MODE);
  }

  // Forward any extra_params from the unlimited config (e.g., minimax_hailuo
  // wants --model=minimax-2.3 to lock to the unlimited tier).
  if (unlimitedEntry?.extra_params) {
    for (const [key, value] of Object.entries(unlimitedEntry.extra_params)) {
      cliArgs.push(`--${key}`, String(value));
    }
  }

  console.log(`Running: higgsfield ${cliArgs.join(' ')}\n`);

  const { stdout } = await runHiggsfield(cliArgs);

  // CLI prints progress + final JSON. The JSON is the last balanced
  // {...} or [...] block in stdout. Find it by scanning from the end.
  let jobJson;
  const jsonMatch = stdout.match(/(\[[\s\S]*\]|\{[\s\S]*\})\s*$/);
  if (!jsonMatch) {
    console.error('Could not find JSON in CLI output. Raw stdout:');
    console.error(stdout);
    process.exit(1);
  }
  try {
    jobJson = JSON.parse(jsonMatch[1]);
  } catch (err) {
    console.error('Failed to parse CLI JSON output:', err.message);
    console.error('Raw match:', jsonMatch[1].slice(0, 1000));
    process.exit(1);
  }

  const videoUrl = extractVideoUrl(jobJson);
  if (!videoUrl) {
    console.error('Could not find video URL in job JSON. Full job object:');
    console.error(JSON.stringify(jobJson, null, 2));
    console.error('\nIf the job actually succeeded, the JSON shape may differ from what this');
    console.error('script expects. Update extractVideoUrl() in higgsfield-cli.mjs accordingly.');
    process.exit(1);
  }

  console.log(`\nVideo ready! Downloading...`);
  console.log(`  URL: ${videoUrl}`);

  const outputPath = resolve(OUTPUT);
  await downloadFile(videoUrl, outputPath);

  console.log(`\nSaved to: ${outputPath}`);

  const summary = {
    success: true,
    provider: 'higgsfield',
    model: HF_MODEL,
    unlimited: isUnlimited,
    videoUrl,
    outputPath,
    duration: DURATION,
    mode: MODE
  };

  console.log('\n=== RESULT ===');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
