# Animate Character — Claude Code Skill

Turn any static character image into a lightweight, web-ready sprite sheet animation — powered by [Kling AI](https://klingai.com) and [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

**One image + one sentence = production-ready CSS sprite animation.**

```
/animate-character ./panda.png "idle animation, blinking and breathing"
```

## Why Use This?

Adding character animations to websites usually means hiring an animator, learning complex tools like Spine or After Effects, or embedding heavy GIF/video files that hurt performance.

This skill takes a different approach:

- **Input:** A single static character image (PNG/JPG) + a plain-English animation description
- **Output:** A single sprite sheet PNG (~50-150KB) + ready-to-paste CSS

No JavaScript runtime needed. No video decoder. No heavy assets. Just a CSS `steps()` animation that works everywhere — plain HTML, React, Vue, static sites — and weighs kilobytes instead of megabytes.

### The Pipeline

```
Source Image  →  Kling AI Video  →  Frame Extraction  →  Sprite Sheet + CSS
  (PNG/JPG)       (MP4, 2-5s)       (ffmpeg, 12fps)      (single PNG)
```

1. You provide a character image and describe the animation
2. Claude analyzes the image, crafts an optimized Kling AI prompt, and asks for your approval
3. Kling AI generates a short animation video from your image
4. ffmpeg extracts frames, removes the background (chroma-key), and assembles a sprite sheet
5. You get a single PNG + CSS/React code ready to drop into your project

### What You Get

```
sprites/
├── idle.png        # Single sprite sheet PNG (~50-150KB)
└── idle.json       # Metadata: frame count, dimensions, CSS + React snippets
```

Paste the CSS and your character is animated:

```css
.sprite-idle {
  width: 200px;
  height: 200px;
  background: url('idle.png') left center;
  animation: sprite-idle-play 2s steps(24) infinite;
}

@keyframes sprite-idle-play {
  to { background-position: right center; }
}
```

See it in action: open [`demo/index.html`](demo/index.html) in your browser.

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI installed
- [Node.js](https://nodejs.org) 18+
- [ffmpeg](https://ffmpeg.org/download.html) installed and in PATH
- [Kling AI API](https://app.klingai.com/global/dev) credentials (Access Key + Secret Key)

## Installation

### Quick Install (Recommended)

**Windows (PowerShell):**
```powershell
git clone https://github.com/TamerinTECH/claude-skill-klingai-animation.git
cd claude-skill-klingai-animation
.\install.ps1
```

**Mac / Linux:**
```bash
git clone https://github.com/TamerinTECH/claude-skill-klingai-animation.git
cd claude-skill-klingai-animation
chmod +x install.sh && ./install.sh
```

The installer will:
1. Check that ffmpeg and Node.js are installed
2. Copy the skill to `~/.claude/skills/animate-character`
3. Ask for your Kling AI API credentials and save them automatically

### Manual Install

#### Option 1: Personal skill (available in all projects)

```bash
git clone https://github.com/TamerinTECH/claude-skill-klingai-animation.git
cp -r claude-skill-klingai-animation/skill ~/.claude/skills/animate-character
```

#### Option 2: Project skill (single project only)

```bash
cd your-project
cp -r /path/to/claude-skill-klingai-animation/skill .claude/skills/animate-character
```

#### Option 3: Git submodule

```bash
cd your-project
git submodule add https://github.com/TamerinTECH/claude-skill-klingai-animation.git .claude/skills/animate-character
```

### Set Up API Credentials

> **If you used the installer above, your credentials are already saved.** The steps below are only needed for manual installs.

Get your keys from the [Kling AI Developer Console](https://app.klingai.com/global/dev), then set them as environment variables:

**Windows** (persistent — survives terminal restarts):
```powershell
[Environment]::SetEnvironmentVariable("KLING_ACCESS_KEY", "your-access-key", "User")
[Environment]::SetEnvironmentVariable("KLING_SECRET_KEY", "your-secret-key", "User")
```

**Mac / Linux** (add to `~/.bashrc` or `~/.zshrc`):
```bash
export KLING_ACCESS_KEY="your-access-key"
export KLING_SECRET_KEY="your-secret-key"
```

## Usage

### In Claude Code (full pipeline)

```
/animate-character ./character.png "celebration, happy jump with clapping"
```

Claude will:
1. Show you an analysis of your source image
2. Propose a Kling AI video prompt for your approval
3. Generate the video and convert it to a sprite sheet
4. Deliver the PNG + CSS/React snippet ready to paste into your project

### Standalone Scripts

**Generate video only:**
```bash
node .claude/skills/animate-character/scripts/kling-generate.mjs \
  --access-key=$KLING_ACCESS_KEY \
  --secret-key=$KLING_SECRET_KEY \
  --image=./character.png \
  --prompt="A panda bouncing happily on green background" \
  --duration=5 \
  --output=./output/animation.mp4
```

**Convert existing video to sprite sheet:**
```bash
node .claude/skills/animate-character/scripts/video-to-spritesheet.mjs \
  --input=./animation.mp4 \
  --output=./sprites \
  --fps=12 \
  --width=200 \
  --name=celebration
```

## Options

### Kling AI Video Generation

| Option | Default | Description |
|--------|---------|-------------|
| `--image` | (required) | Path to source character image |
| `--prompt` | (required) | Animation description |
| `--duration` | `5` | Video duration in seconds (5 or 10) |
| `--model` | `kling-v3` | Kling model version |
| `--mode` | `std` | Quality: `std` (fast) or `pro` (higher quality) |
| `--aspect-ratio` | `1:1` | Output aspect ratio |
| `--output` | `./animation.mp4` | Output file path |

### Sprite Sheet Conversion

| Option | Default | Description |
|--------|---------|-------------|
| `--input` | (required) | Path to MP4 video |
| `--output` | `./sprites` | Output directory |
| `--quality` | `high` | Preset: `low` (8fps, lighter) or `high` (12fps, smoother) |
| `--fps` | `12` / `8` | Frames per second to extract. Overrides `--quality` fps. |
| `--width` | `200` | Frame width in pixels |
| `--height` | (auto) | Frame height (auto preserves aspect ratio) |
| `--remove-bg` | `green` | Background removal: `green`, `none` |
| `--format` | `horizontal` | Layout: `horizontal`, `vertical`, `grid` |
| `--name` | `spritesheet` | Name for output files and CSS classes |

## Prompt Tips for Best Results

- **Always mention "solid green background"** — enables clean background removal
- **Always mention "no camera movement"** — keeps character centered
- **Keep animations short** — 2-3 seconds is ideal for looping
- **Be specific about motion** — describe exactly what moves and how
- **Request looping** — ask for animation to return to starting pose

### Example Prompts

**Idle:**
> A cute cartoon panda standing still on a solid green background, blinking slowly, breathing gently with subtle body movement, looking to the right, waiting patiently. Smooth looping animation, 3 seconds. No camera movement.

**Celebration:**
> A cute cartoon panda on a solid green background, doing a small happy jump with a big smile, clapping hands excitedly. Short bouncy movement. Smooth animation, 2 seconds. No camera movement.

**Thinking:**
> A cute cartoon panda on a solid green background, tilting head to the side with a curious expression, one hand on chin, thinking. Gentle movement. Smooth animation, 2 seconds. No camera movement.

## How It Works

| Step | Tool | Details |
|------|------|---------|
| Auth | Node.js crypto | JWT token (HS256) generated locally from your keys. Valid 30 min. Credentials never leave your machine. |
| Video | Kling AI API | Image-to-video generation. Polls every 10s until complete (up to 10 min). |
| Frames | ffmpeg | Extracts frames at target FPS, scales to target width. |
| Background | ffmpeg chromakey | Removes green screen, produces transparent PNGs. |
| Assembly | ffmpeg xstack | Combines frames into a single sprite sheet. Falls back to ImageMagick if needed. |

## Integrating the Animation

### Plain HTML

```html
<div class="sprite-idle"></div>
<style>
  .sprite-idle {
    width: 200px;
    height: 200px;
    background: url('idle.png') left center;
    animation: sprite-idle-play 2s steps(24) infinite;
  }
  @keyframes sprite-idle-play {
    to { background-position: right center; }
  }
</style>
```

### React

```jsx
<div
  style={{
    width: 200,
    height: 200,
    backgroundImage: `url('/sprites/idle.png')`,
    backgroundSize: '4800px 200px',
    animation: 'sprite-idle-play 2s steps(24) infinite'
  }}
/>
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ffmpeg not found` | Install from https://ffmpeg.org/download.html and ensure it's in your PATH |
| `API credentials required` | Set `KLING_ACCESS_KEY` and `KLING_SECRET_KEY` environment variables |
| Task times out | Try `--mode=std` for faster generation |
| Poor background removal | Use a more saturated green in prompts, or try `--remove-bg=none` |
| Character looks different | Use the same source image and consistent prompt structure across animations |
| Sprite sheet too large | Reduce `--fps` (8 is still smooth) or `--width` |

## License

[MIT](LICENSE) — [TamerinTech](https://github.com/TamerinTECH)
