---
name: animate-character
description: Generate character animations from a source image using Kling AI video generation, then convert the resulting MP4 video into an optimized sprite sheet for web use. Use when the user wants to create character animations, sprite sheets, or animate illustrations.
disable-model-invocation: true
argument-hint: <source-image-path> <animation-description>
allowed-tools: Read, Write, Bash, Glob, WebFetch
---

# Animate Character — Kling AI to Sprite Sheet Pipeline

This skill takes a source character image and an animation description, generates an animated video using the Kling AI API, then converts the video into an optimized sprite sheet ready for web use.

## Prerequisites

The user must provide their Kling AI API credentials. Check for environment variables:
- `KLING_ACCESS_KEY` — Kling API Access Key ID
- `KLING_SECRET_KEY` — Kling API Secret Key

If not set, ask the user to provide them. They can get credentials from https://app.klingai.com/global/dev

ffmpeg must be installed (verify with `ffmpeg -version`).

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

### Step 3: Call the Kling AI API

Use the Node.js script at `${CLAUDE_SKILL_DIR}/scripts/kling-generate.mjs` to generate the video:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/kling-generate.mjs" \
  --access-key="$KLING_ACCESS_KEY" \
  --secret-key="$KLING_SECRET_KEY" \
  --image="<SOURCE_IMAGE_PATH>" \
  --prompt="<the-approved-prompt>" \
  --duration=5 \
  --output="<output-directory>/animation.mp4"
```

The script will:
1. Generate a JWT token from the access/secret keys
2. Read the image and encode it as raw base64 (no data URI prefix — Kling API requirement)
3. Submit the image-to-video task to Kling AI
4. Poll for completion (every 10 seconds, up to 10 minutes)
5. Download the resulting MP4 video

If the user hasn't set environment variables, pass the keys directly via `--access-key` and `--secret-key` flags (ask the user for them).

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
- `--fps` — Frames per second to extract (default: 12, range: 8-30)
- `--width` — Frame width in pixels (default: 200)
- `--height` — Frame height in pixels (default: auto, maintains aspect ratio)
- `--duration` — Video duration in seconds (default: 5, options: 5 or 10)
- `--model` — Kling model version (default: kling-v3)
- `--mode` — Quality mode: "std" (fast) or "pro" (higher quality) (default: std)
- `--remove-bg` — Background removal method: "green" (chroma-key), "auto" (AI-based), or "none" (default: green)
- `--format` — Output format: "horizontal" (single row), "grid" (rows x cols), or "vertical" (single column) (default: horizontal)

## Error Handling

- If Kling API returns an error, show the error message and suggest the user check their API credits
- If ffmpeg is not installed, provide installation instructions
- If the video generation times out, suggest trying with `--mode=std` for faster generation
- If background removal produces poor results, suggest the user try `--remove-bg=auto` or `--remove-bg=none` and manually remove the background

## Additional Resources

- For complete script source code, see [scripts/kling-generate.mjs](scripts/kling-generate.mjs)
- For the sprite sheet converter, see [scripts/video-to-spritesheet.mjs](scripts/video-to-spritesheet.mjs)
