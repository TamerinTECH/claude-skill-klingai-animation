#!/usr/bin/env node

/**
 * Kling AI Image-to-Video Generator
 *
 * Generates a JWT token, submits an image-to-video task to Kling AI,
 * polls for completion, and downloads the resulting MP4.
 *
 * Usage:
 *   node kling-generate.mjs \
 *     --access-key=YOUR_KEY \
 *     --secret-key=YOUR_SECRET \
 *     --image=./character.png \
 *     --prompt="A panda bouncing happily on green background" \
 *     --duration=5 \
 *     --output=./output/animation.mp4
 */

import { createHmac } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';

// ---------- CLI argument parsing ----------

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

const args = parseArgs(process.argv);

const ACCESS_KEY = args['access-key'] || process.env.KLING_ACCESS_KEY;
const SECRET_KEY = args['secret-key'] || process.env.KLING_SECRET_KEY;
const IMAGE_PATH = args['image'];
const PROMPT = args['prompt'] || '';
const DURATION = args['duration'] || '5';
const MODEL = args['model'] || 'kling-v1-6';
const MODE = args['mode'] || 'std';
const OUTPUT = args['output'] || './animation.mp4';
const ASPECT_RATIO = args['aspect-ratio'] || '1:1';

const API_BASE = 'https://api.klingai.com/v1';
const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 60; // 10 minutes max

// ---------- JWT token generation ----------

function base64url(data) {
  return Buffer.from(data).toString('base64url');
}

function generateJWT(accessKey, secretKey) {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const payload = {
    iss: accessKey,
    exp: now + 1800, // 30 minutes
    nbf: now - 5,    // valid 5 seconds ago
    iat: now
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = createHmac('sha256', secretKey)
    .update(signingInput)
    .digest('base64url');

  return `${signingInput}.${signature}`;
}

// ---------- API helpers ----------

async function apiRequest(method, path, body, token) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`API returned non-JSON response (${res.status}): ${text.slice(0, 500)}`);
  }

  if (!res.ok && data.code !== 0) {
    throw new Error(`API error (${res.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

async function imageToBase64(imagePath) {
  const absPath = resolve(imagePath);
  const ext = extname(absPath).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp'
  };
  const mime = mimeTypes[ext] || 'image/png';
  const buffer = await readFile(absPath);
  return `data:${mime};base64,${buffer.toString('base64')}`;
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

// ---------- Main pipeline ----------

async function main() {
  // Validate inputs
  if (!ACCESS_KEY || !SECRET_KEY) {
    console.error('Error: Kling API credentials required.');
    console.error('Set KLING_ACCESS_KEY and KLING_SECRET_KEY environment variables,');
    console.error('or pass --access-key=... and --secret-key=... arguments.');
    process.exit(1);
  }

  if (!IMAGE_PATH) {
    console.error('Error: --image=<path> is required.');
    process.exit(1);
  }

  console.log('=== Kling AI Image-to-Video Generator ===');
  console.log(`Image: ${IMAGE_PATH}`);
  console.log(`Prompt: ${PROMPT}`);
  console.log(`Duration: ${DURATION}s | Model: ${MODEL} | Mode: ${MODE}`);
  console.log(`Output: ${OUTPUT}`);
  console.log('');

  // Generate JWT
  console.log('Generating JWT token...');
  const token = generateJWT(ACCESS_KEY, SECRET_KEY);

  // Prepare image
  console.log('Reading and encoding image...');
  const imageData = await imageToBase64(IMAGE_PATH);

  // Create task
  console.log('Submitting image-to-video task to Kling AI...');
  const createBody = {
    model_name: MODEL,
    mode: MODE,
    duration: DURATION,
    aspect_ratio: ASPECT_RATIO,
    image: imageData,
    prompt: PROMPT
  };

  const createResponse = await apiRequest('POST', '/videos/image2video', createBody, token);

  if (createResponse.code !== 0) {
    console.error('Task creation failed:', JSON.stringify(createResponse, null, 2));
    process.exit(1);
  }

  const taskId = createResponse.data?.task_id;
  if (!taskId) {
    console.error('No task_id in response:', JSON.stringify(createResponse, null, 2));
    process.exit(1);
  }

  console.log(`Task created: ${taskId}`);
  console.log('Polling for completion...');

  // Poll for completion
  let attempt = 0;
  let result = null;

  while (attempt < MAX_POLL_ATTEMPTS) {
    attempt++;
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    // Regenerate token if close to expiry (every 20 minutes)
    const currentToken = attempt % 120 === 0 ? generateJWT(ACCESS_KEY, SECRET_KEY) : token;

    const statusResponse = await apiRequest(
      'GET',
      `/videos/image2video/${taskId}`,
      null,
      currentToken
    );

    const taskStatus = statusResponse.data?.task_status;
    const statusMsg = statusResponse.data?.task_status_msg || '';

    const elapsed = (attempt * POLL_INTERVAL_MS / 1000).toFixed(0);
    console.log(`  [${elapsed}s] Status: ${taskStatus} ${statusMsg}`);

    if (taskStatus === 'succeed') {
      result = statusResponse.data;
      break;
    }

    if (taskStatus === 'failed') {
      console.error('Task failed:', JSON.stringify(statusResponse.data, null, 2));
      process.exit(1);
    }

    // Continue polling for: submitted, processing, etc.
  }

  if (!result) {
    console.error(`Timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`);
    process.exit(1);
  }

  // Download video
  const videos = result.task_result?.videos;
  if (!videos || videos.length === 0) {
    console.error('No videos in result:', JSON.stringify(result, null, 2));
    process.exit(1);
  }

  const videoUrl = videos[0].url;
  console.log(`\nVideo ready! Downloading...`);
  console.log(`  URL: ${videoUrl}`);

  const outputPath = resolve(OUTPUT);
  await downloadFile(videoUrl, outputPath);

  console.log(`\nSaved to: ${outputPath}`);

  // Output JSON summary for the skill to parse
  const summary = {
    success: true,
    taskId,
    videoUrl,
    outputPath,
    duration: DURATION,
    model: MODEL,
    mode: MODE
  };

  console.log('\n=== RESULT ===');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
