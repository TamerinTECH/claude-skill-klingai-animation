#!/usr/bin/env node

/**
 * Video-to-Sprite-Sheet Converter
 *
 * Extracts frames from an MP4 video, optionally removes background,
 * and combines them into a single sprite sheet PNG with metadata.
 *
 * Usage:
 *   node video-to-spritesheet.mjs \
 *     --input=./animation.mp4 \
 *     --output=./sprites \
 *     --fps=12 \
 *     --width=200 \
 *     --remove-bg=green
 *
 * Requires: ffmpeg (installed and in PATH)
 */

import { execSync } from 'node:child_process';
import { readdir, readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';

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

const INPUT = args['input'];
const OUTPUT_DIR = args['output'] || './sprites';
const QUALITY = args['quality'] || 'high';
const DEFAULT_FPS = QUALITY === 'low' ? '8' : '12';
const FPS = parseInt(args['fps'] || DEFAULT_FPS, 10);
const FRAME_WIDTH = parseInt(args['width'] || '200', 10);
const FRAME_HEIGHT = args['height'] ? parseInt(args['height'], 10) : null;
const REMOVE_BG = args['remove-bg'] || 'green';
const FORMAT = args['format'] || 'horizontal';
const NAME = args['name'] || 'spritesheet';

// ---------- Helpers ----------

function run(cmd, options = {}) {
  return execSync(cmd, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options
  }).trim();
}

function checkFfmpeg() {
  try {
    run('ffmpeg -version');
    return true;
  } catch {
    return false;
  }
}

function getVideoInfo(inputPath) {
  const durationStr = run(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${inputPath}"`
  );
  const widthStr = run(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "${inputPath}"`
  );
  const heightStr = run(
    `ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "${inputPath}"`
  );

  return {
    duration: parseFloat(durationStr),
    width: parseInt(widthStr, 10),
    height: parseInt(heightStr, 10)
  };
}

// ---------- Frame extraction ----------

function extractFrames(inputPath, framesDir, fps, width, height) {
  let scaleFilter;
  if (height) {
    scaleFilter = `scale=${width}:${height}`;
  } else {
    scaleFilter = `scale=${width}:-1`;
  }

  const cmd = `ffmpeg -y -i "${inputPath}" -vf "fps=${fps},${scaleFilter}" "${join(framesDir, 'frame_%04d.png')}"`;
  run(cmd);

  // Return sorted frame file list (cross-platform)
  const files = readdirSync(framesDir)
    .filter(f => f.endsWith('.png'))
    .sort();

  return files;
}

// ---------- Background removal ----------

function removeGreenScreen(framesDir, frameFiles) {
  // Use ffmpeg's chromakey filter to remove green background
  // Process each frame individually for transparency support
  const processedDir = join(framesDir, 'processed');
  mkdirSync(processedDir, { recursive: true });

  for (const file of frameFiles) {
    const input = join(framesDir, file);
    const output = join(processedDir, file);

    // chromakey: remove green (0x00FF00) with similarity 0.3 and blend 0.1
    const cmd = `ffmpeg -y -i "${input}" -vf "chromakey=0x00FF00:0.30:0.10" "${output}"`;
    try {
      run(cmd);
    } catch {
      // If chromakey fails, try with a wider range
      const cmdFallback = `ffmpeg -y -i "${input}" -vf "chromakey=0x00FF00:0.40:0.15" "${output}"`;
      try {
        run(cmdFallback);
      } catch {
        // Last resort: copy as-is
        copyFileSync(input, output);
      }
    }
  }

  return processedDir;
}

// ---------- Sprite sheet assembly ----------

async function assembleSpriteSheet(sourceDir, frameFiles, outputPath, format) {
  const frameCount = frameFiles.length;

  if (frameCount === 0) {
    throw new Error('No frames to assemble');
  }

  // Get dimensions of first frame
  const firstFrameInfo = run(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${join(sourceDir, frameFiles[0])}"`
  );
  const [fWidth, fHeight] = firstFrameInfo.split(',').map(Number);

  let cols, rows, tileLayout;

  if (format === 'vertical') {
    cols = 1;
    rows = frameCount;
    tileLayout = `1x${frameCount}`;
  } else if (format === 'grid') {
    cols = Math.ceil(Math.sqrt(frameCount));
    rows = Math.ceil(frameCount / cols);
    tileLayout = `${cols}x${rows}`;
  } else {
    // horizontal (default)
    cols = frameCount;
    rows = 1;
    tileLayout = `${frameCount}x1`;
  }

  // Use ffmpeg tile filter to create sprite sheet
  // Build input list
  const inputArgs = frameFiles.map(f => `-i "${join(sourceDir, f)}"`).join(' ');

  // For many frames, use a concat approach
  const listFile = join(sourceDir, 'filelist.txt');
  const listContent = frameFiles.map(f => `file '${join(sourceDir, f)}'`).join('\n');
  await writeFile(listFile, listContent);

  // Use ffmpeg's tile filter with multiple inputs
  const cmd = `ffmpeg -y ${inputArgs} -filter_complex "xstack=inputs=${frameCount}:layout=${generateLayout(frameCount, fWidth, fHeight, format)}:fill=none" -frames:v 1 "${outputPath}"`;

  try {
    run(cmd);
  } catch {
    // Fallback: use ImageMagick's montage if available, or manual tile
    try {
      const montageCmd = `magick montage "${join(sourceDir, '*.png')}" -tile ${tileLayout} -geometry ${fWidth}x${fHeight}+0+0 -background none "${outputPath}"`;
      run(montageCmd);
    } catch {
      // Last fallback: use ffmpeg hstack/vstack for simpler layouts
      if (format === 'horizontal' || format === 'grid') {
        const hstackCmd = `ffmpeg -y ${inputArgs} -filter_complex "hstack=inputs=${frameCount}" -frames:v 1 "${outputPath}"`;
        run(hstackCmd);
      } else {
        const vstackCmd = `ffmpeg -y ${inputArgs} -filter_complex "vstack=inputs=${frameCount}" -frames:v 1 "${outputPath}"`;
        run(vstackCmd);
      }
    }
  }

  return { frameWidth: fWidth, frameHeight: fHeight, cols, rows, frameCount };
}

function generateLayout(count, w, h, format) {
  const positions = [];
  if (format === 'vertical') {
    for (let i = 0; i < count; i++) {
      positions.push(`0_${i * h}`);
    }
  } else if (format === 'grid') {
    const cols = Math.ceil(Math.sqrt(count));
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.push(`${col * w}_${row * h}`);
    }
  } else {
    // horizontal
    for (let i = 0; i < count; i++) {
      positions.push(`${i * w}_0`);
    }
  }
  return positions.join('|');
}

// ---------- Metadata generation ----------

function generateMetadata(info, fps, outputPath, name) {
  const durationSec = info.frameCount / fps;

  const metadata = {
    name,
    spriteSheet: basename(outputPath),
    frameCount: info.frameCount,
    frameWidth: info.frameWidth,
    frameHeight: info.frameHeight,
    columns: info.cols,
    rows: info.rows,
    fps,
    totalDuration: `${durationSec.toFixed(2)}s`,
    totalWidth: info.cols * info.frameWidth,
    totalHeight: info.rows * info.frameHeight,
    css: {
      className: `sprite-${name}`,
      snippet: `.sprite-${name} {
  width: ${info.frameWidth}px;
  height: ${info.frameHeight}px;
  background: url('${basename(outputPath)}') left center;
  background-size: ${info.cols * info.frameWidth}px ${info.rows * info.frameHeight}px;
  animation: sprite-${name}-play ${durationSec.toFixed(2)}s steps(${info.frameCount}) infinite;
}

@keyframes sprite-${name}-play {
  to { background-position: right center; }
}`
    },
    react: {
      snippet: `<div
  style={{
    width: ${info.frameWidth},
    height: ${info.frameHeight},
    backgroundImage: \`url('/sprites/${basename(outputPath)}')\`,
    backgroundSize: '${info.cols * info.frameWidth}px ${info.rows * info.frameHeight}px',
    animation: 'sprite-${name}-play ${durationSec.toFixed(2)}s steps(${info.frameCount}) infinite'
  }}
/>`
    }
  };

  return metadata;
}

// ---------- Main pipeline ----------

async function main() {
  if (!INPUT) {
    console.error('Error: --input=<path-to-mp4> is required.');
    console.error('');
    console.error('Usage:');
    console.error('  node video-to-spritesheet.mjs --input=video.mp4 [options]');
    console.error('');
    console.error('Options:');
    console.error('  --output=<dir>       Output directory (default: ./sprites)');
    console.error('  --quality=<preset>   Quality preset: low (8fps) or high (12fps) (default: high)');
    console.error('  --fps=<number>       Frames per second (default: 12 high, 8 low). Overrides --quality.');
    console.error('  --width=<px>         Frame width in pixels (default: 200)');
    console.error('  --height=<px>        Frame height in pixels (default: auto)');
    console.error('  --remove-bg=<mode>   Background removal: green, none (default: green)');
    console.error('  --format=<layout>    Sprite layout: horizontal, vertical, grid (default: horizontal)');
    console.error('  --name=<string>      Animation name for CSS classes (default: spritesheet)');
    process.exit(1);
  }

  if (!checkFfmpeg()) {
    console.error('Error: ffmpeg is not installed or not in PATH.');
    console.error('Install it from https://ffmpeg.org/download.html');
    process.exit(1);
  }

  const inputPath = resolve(INPUT);
  const outputDir = resolve(OUTPUT_DIR);

  if (!existsSync(inputPath)) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  console.log('=== Video to Sprite Sheet Converter ===');
  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outputDir}`);
  console.log(`FPS: ${FPS} | Frame width: ${FRAME_WIDTH}px | BG removal: ${REMOVE_BG}`);
  console.log('');

  // Get video info
  const videoInfo = getVideoInfo(inputPath);
  console.log(`Video: ${videoInfo.width}x${videoInfo.height}, ${videoInfo.duration.toFixed(2)}s`);

  const expectedFrames = Math.floor(videoInfo.duration * FPS);
  console.log(`Expected frames: ~${expectedFrames}`);
  console.log('');

  // Create output and temp directories
  await mkdir(outputDir, { recursive: true });
  const framesDir = join(outputDir, '_temp_frames');
  await mkdir(framesDir, { recursive: true });

  // Extract frames
  console.log('Extracting frames...');
  const frameFiles = extractFrames(inputPath, framesDir, FPS, FRAME_WIDTH, FRAME_HEIGHT);
  console.log(`  Extracted ${frameFiles.length} frames`);

  // Remove background
  let sourceDir = framesDir;
  if (REMOVE_BG === 'green') {
    console.log('Removing green background...');
    sourceDir = removeGreenScreen(framesDir, frameFiles);
    console.log('  Done');
  }

  // Assemble sprite sheet
  const spritesheetPath = join(outputDir, `${NAME}.png`);
  console.log(`Assembling sprite sheet (${FORMAT})...`);
  const sheetInfo = await assembleSpriteSheet(sourceDir, frameFiles, spritesheetPath, FORMAT);
  console.log(`  ${sheetInfo.frameCount} frames, ${sheetInfo.cols}x${sheetInfo.rows} grid`);
  console.log(`  Frame size: ${sheetInfo.frameWidth}x${sheetInfo.frameHeight}px`);
  console.log(`  Sheet size: ${sheetInfo.cols * sheetInfo.frameWidth}x${sheetInfo.rows * sheetInfo.frameHeight}px`);

  // Generate metadata
  const metadata = generateMetadata(sheetInfo, FPS, spritesheetPath, NAME);
  const metadataPath = join(outputDir, `${NAME}.json`);
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

  // Get file size
  const fileStats = await stat(spritesheetPath);
  const fileSizeKB = (fileStats.size / 1024).toFixed(1);

  // Cleanup temp files
  console.log('Cleaning up temporary files...');
  await rm(framesDir, { recursive: true, force: true });

  // Summary
  console.log('');
  console.log('=== RESULT ===');
  console.log(JSON.stringify({
    success: true,
    spriteSheet: spritesheetPath,
    metadata: metadataPath,
    frameCount: sheetInfo.frameCount,
    frameWidth: sheetInfo.frameWidth,
    frameHeight: sheetInfo.frameHeight,
    sheetWidth: sheetInfo.cols * sheetInfo.frameWidth,
    sheetHeight: sheetInfo.rows * sheetInfo.frameHeight,
    fileSizeKB: parseFloat(fileSizeKB),
    css: metadata.css.snippet
  }, null, 2));

  console.log('');
  console.log('=== CSS Snippet ===');
  console.log(metadata.css.snippet);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
