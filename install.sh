#!/bin/bash
# Animate Character Skill — Installer for Claude Code
# Installs the skill to your personal ~/.claude/skills directory

set -e

SKILL_NAME="animate-character"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/skill"
TARGET_DIR="$HOME/.claude/skills/$SKILL_NAME"

echo "=== Animate Character Skill Installer ==="
echo ""

# Check prerequisites
if command -v ffmpeg &>/dev/null; then
    echo "[OK] ffmpeg found"
else
    echo "[!!] ffmpeg not found. Install from https://ffmpeg.org/download.html"
    exit 1
fi

if command -v node &>/dev/null; then
    echo "[OK] Node.js $(node --version) found"
else
    echo "[!!] Node.js not found. Install from https://nodejs.org"
    exit 1
fi

# Check source files
if [ ! -f "$SOURCE_DIR/SKILL.md" ]; then
    echo "[!!] SKILL.md not found in $SOURCE_DIR"
    exit 1
fi

# Install
if [ -d "$TARGET_DIR" ]; then
    echo "[..] Removing existing installation at $TARGET_DIR"
    rm -rf "$TARGET_DIR"
fi

echo "[..] Installing to $TARGET_DIR"
mkdir -p "$(dirname "$TARGET_DIR")"
cp -r "$SOURCE_DIR" "$TARGET_DIR"

# Verify
if [ -f "$TARGET_DIR/SKILL.md" ]; then
    echo ""
    echo "[OK] Skill installed successfully!"
    echo ""
    echo "Usage in Claude Code:"
    echo '  /animate-character ./character.png "idle animation, blinking"'
    echo ""
    echo "Set your Kling AI credentials:"
    echo '  export KLING_ACCESS_KEY="your-access-key"'
    echo '  export KLING_SECRET_KEY="your-secret-key"'
    echo ""
    echo "Get API keys from: https://app.klingai.com/global/dev"
else
    echo "[!!] Installation failed"
    exit 1
fi
