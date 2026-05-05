---
name: animate-character
description: Generate character animations from a source image using Kling AI video generation (direct API or via the Higgsfield CLI), then convert the resulting MP4 video into an optimized sprite sheet for web use. Use when the user wants to create character animations, sprite sheets, or animate illustrations.
disable-model-invocation: true
argument-hint: <source-image-path> <animation-description>
allowed-tools: Read, Write, Bash, Glob, WebFetch
---

# Animate Character — Image to Sprite Sheet Pipeline

This skill takes a source character image and an animation description, generates an animated video, then converts the video into an optimized sprite sheet ready for web use.

Two video-generation backends are supported:
- **Kling direct API** — JWT auth, requires `KLING_ACCESS_KEY` + `KLING_SECRET_KEY` env vars.
- **Higgsfield CLI** — handles auth internally (one-time `higgsfield auth login`). Routes through Kling 3.0 by default but exposes 15+ other models (Seedance, Veo, Wan, Hailuo, …) via a single flag.

The dispatcher (`scripts/generate.mjs`) auto-detects which one to use, or the user can force a choice with `--provider=kling` or `--provider=higgsfield`.

## Prerequisites

At least one of the two backends must be available:

**Option A — Kling direct API:**
- `KLING_ACCESS_KEY` and `KLING_SECRET_KEY` env vars set.
- Get credentials from https://app.klingai.com/global/dev

**Option B — Higgsfield CLI:**
- `higgsfield` CLI installed and on PATH (`npm install -g @higgsfield-ai/cli` or via the [skills repo](https://github.com/higgsfield-ai/skills)).
- One-time `higgsfield auth login`.
- Verify with `higgsfield model list --json`.

ffmpeg must also be installed (verify with `ffmpeg -version`).

If the user has neither configured, ask which one they'd like to use and walk them through setup. If they have both, default to Kling direct unless they specifically asked for Higgsfield.

## Workflow

### Step 0: Resolve the Source Image

The user may provide the image in different ways. Handle ALL of these:

1. **Path as argument** — `$ARGUMENTS[0]` contains a file path (e.g., `./character.png`). Verify the file exists, then read it.

2. **Image attached / drag-and-dropped** — The user dragged an image file into Claude Code. The image is visible in the conversation but `$ARGUMENTS[0]` may not be a valid path. In this case:
   - You can already see the image visually — use it for analysis in Step 1.
   - You still need the **file path on disk** for the generation script. Check if the attachment metadata includes the original path.
   - If you cannot determine the path, ask the user: "I can see your character image. Where is the file located on disk? (e.g., `./demo/fox.png`)"

3. **Only a description, no image** — `$ARGUMENTS` contains only text. Ask the user to provide an image path or attach an image.

Once you have a confirmed file path on disk, store it as the `SOURCE_IMAGE_PATH` for use in Step 3.

The animation description may come from `$ARGUMENTS[1]` (if a path was the first argument) or from the full `$ARGUMENTS` text (if the image was attached separately). Parse accordingly.

### Step 1: Analyze the Source Image

Read the source image to understand the character:
- What type of character is it (animal, human, cartoon, etc.)
- Its visual style (flat, 3D, cartoon, pixel art, etc.)
- Background type (transparent, solid color, complex)
- Character pose and orientation

Tell the user what you see and confirm the animation intention.

### Step 2: Generate the Video Prompt

Based on the image analysis and the user's animation description, craft an optimized Kling AI video prompt. Follow these guidelines:

- **Always specify** "solid green background" or "solid colored background" for easy chroma-key removal
- **Always specify** "no camera movement" to keep the character centered
- **Always specify** "smooth animation" and the desired duration (2-3 seconds)
- **Keep the character consistent** — describe the character as it appears in the source image
- **Be specific about the motion** — describe exactly what body parts move and how
- **Specify looping** — ask for the animation to return to starting pose

Example prompts:
- Idle: "A cute cartoon panda standing still on a solid green background, blinking slowly, breathing gently with subtle body movement, looking to the right, waiting patiently. Smooth looping animation, 3 seconds. No camera movement."
- Celebration: "A cute cartoon panda on a solid green background, doing a small happy jump with a big smile, clapping hands excitedly. Short bouncy movement. Smooth animation, 2 seconds. No camera movement."

Show the prompt to the user for approval before proceeding.

### Step 3: Generate the Video

Use the dispatcher at `${CLAUDE_SKILL_DIR}/scripts/generate.mjs`. It picks the right backend and forwards args.

```bash
node "${CLAUDE_SKILL_DIR}/scripts/generate.mjs" \
  --provider=<kling|higgsfield> \
  --image="<SOURCE_IMAGE_PATH>" \
  --prompt="<the-approved-prompt>" \
  --duration=5 \
  --output="<output-directory>/animation.mp4"
```

If `--provider` is omitted, the dispatcher auto-detects:
1. If `KLING_ACCESS_KEY` + `KLING_SECRET_KEY` are set → Kling direct API.
2. Else if `higgsfield` CLI is on PATH and authenticated → Higgsfield CLI.
3. Else: prints setup hints and exits.

**Provider-specific options:**

- **Kling direct (`--provider=kling`):** Same flags as before. `--access-key` and `--secret-key` may be passed explicitly if env vars are not set. Uses Kling's `kling-v3` model in `std` mode by default.
- **Higgsfield (`--provider=higgsfield`):** Adds `--hf-model=<job_set_type>` (default: `kling3_0`). Other useful values:
  - `kling2_6` — cheaper, good for subtle idle motion
  - `seedance_2_0` — high quality but slow
  - `minimax_hailuo` — strong character consistency, supports "static shot" prompts

The script downloads an MP4 to `--output`.

### Step 4: Convert MP4 to Sprite Sheet

Once the video is downloaded, use the script at `${CLAUDE_SKILL_DIR}/scripts/video-to-spritesheet.mjs` to create the sprite sheet:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/video-to-spritesheet.mjs" \
  --input="<path-to-mp4>" \
  --output="<output-directory>" \
  --fps=12 \
  --width=200 \
  --remove-bg=green
```

The script will:
1. Extract frames from the video at the specified FPS using ffmpeg
2. Remove the green/solid background from each frame (chroma-key)
3. Combine all frames into a single horizontal sprite sheet PNG
4. Generate a metadata JSON file with frame count, dimensions, and CSS snippet
5. Clean up temporary frame files

### Step 5: Deliver Results

Report to the user:
- The sprite sheet PNG path and file size
- The metadata JSON path
- Number of frames extracted
- A ready-to-use CSS snippet for animating the sprite sheet
- A preview of what the sprite sheet looks like (read the PNG)

Example CSS output:
```css
.character-animation {
  width: 200px;
  height: 200px;
  background: url('spritesheet.png') left center;
  animation: play 2s steps(24) infinite;
}

@keyframes play {
  to { background-position: right center; }
}
```

## Configuration Options

The user can customize:
- `--quality` — Output quality preset: "low" (8fps, ~150KB, lightweight) or "high" (12fps, ~500KB+, smoother). Default: high. This controls fps and is a convenience shortcut.
- `--fps` — Frames per second to extract (default: 12 for high, 8 for low, range: 8-30). Overrides --quality fps if both specified.
- `--width` — Frame width in pixels (default: 200)
- `--height` — Frame height in pixels (default: auto, maintains aspect ratio)
- `--duration` — Video duration in seconds (default: 5, options: 5 or 10)
- `--provider` — Video backend: "kling" (direct API) or "higgsfield" (CLI). Default: auto-detect.
- `--model` — Kling model version when `--provider=kling` (default: kling-v3)
- `--hf-model` — Higgsfield model job_set_type when `--provider=higgsfield` (default: kling3_0)
- `--mode` — Quality mode: "std" (fast) or "pro" (higher quality) (default: std). Applies to Kling models only.
- `--remove-bg` — Background removal method: "green" (chroma-key), "auto" (AI-based), or "none" (default: green)
- `--format` — Output format: "horizontal" (single row), "grid" (rows x cols), or "vertical" (single column) (default: horizontal)

## Error Handling

- If the API returns an error, show the message and suggest the user check their credits/billing
- If ffmpeg is not installed, provide installation instructions
- If the video generation times out, suggest trying `--mode=std` for faster generation, or switching to `--hf-model=kling2_6` (faster than kling3_0)
- If background removal produces poor results, suggest `--remove-bg=auto` or `--remove-bg=none`
- If `--provider=higgsfield` fails with "higgsfield CLI not found", point the user to `npm install -g @higgsfield-ai/cli` then `higgsfield auth login`
- If neither provider is configured, the dispatcher prints setup hints — surface those verbatim

## Additional Resources

- Dispatcher: [scripts/generate.mjs](scripts/generate.mjs)
- Kling direct provider: [scripts/providers/kling-direct.mjs](scripts/providers/kling-direct.mjs)
- Higgsfield CLI provider: [scripts/providers/higgsfield-cli.mjs](scripts/providers/higgsfield-cli.mjs)
- Sprite sheet converter: [scripts/video-to-spritesheet.mjs](scripts/video-to-spritesheet.mjs)
- Back-compat shim: [scripts/kling-generate.mjs](scripts/kling-generate.mjs) — forwards to dispatcher with `--provider=kling`
