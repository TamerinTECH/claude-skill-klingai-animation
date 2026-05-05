#!/bin/bash
# Animate Character Skill — Installer for Claude Code
# Installs the skill to your personal ~/.claude/skills directory
# and optionally saves your Kling AI API credentials

set -e

SKILL_NAME="animate-character"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="$SCRIPT_DIR/skill"
TARGET_DIR="$HOME/.claude/skills/$SKILL_NAME"

echo ""
echo "=== Animate Character Skill Installer ==="
echo "    Image-to-sprite-sheet animation for Claude Code"
echo "    Backends: Kling direct API or Higgsfield CLI"
echo ""

# ---- Step 1: Check prerequisites ----

echo "Step 1: Checking prerequisites..."
echo ""

if command -v ffmpeg &>/dev/null; then
    echo "  [OK] ffmpeg found"
else
    echo "  [!!] ffmpeg not found."
    echo "       Download it from: https://ffmpeg.org/download.html"
    echo "       After installing, restart this terminal and run the installer again."
    exit 1
fi

if command -v node &>/dev/null; then
    echo "  [OK] Node.js $(node --version) found"
else
    echo "  [!!] Node.js not found."
    echo "       Download it from: https://nodejs.org"
    echo "       After installing, restart this terminal and run the installer again."
    exit 1
fi

if [ ! -f "$SOURCE_DIR/SKILL.md" ]; then
    echo "  [!!] SKILL.md not found in $SOURCE_DIR"
    exit 1
fi

echo ""

# ---- Step 2: Install the skill ----

echo "Step 2: Installing skill files..."
echo ""

if [ -d "$TARGET_DIR" ]; then
    echo "  [..] Removing previous installation"
    rm -rf "$TARGET_DIR"
fi

echo "  [..] Copying skill to $TARGET_DIR"
mkdir -p "$(dirname "$TARGET_DIR")"
cp -r "$SOURCE_DIR" "$TARGET_DIR"

if [ ! -f "$TARGET_DIR/SKILL.md" ]; then
    echo "  [!!] Installation failed — files not copied"
    exit 1
fi

echo "  [OK] Skill files installed"
echo ""

# ---- Step 3: Configure a video-generation backend ----

echo "Step 3: Configure a video-generation backend"
echo ""

# Detect shell profile
SHELL_PROFILE=""
if [ -f "$HOME/.zshrc" ]; then
    SHELL_PROFILE="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_PROFILE="$HOME/.bashrc"
elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_PROFILE="$HOME/.bash_profile"
fi

# Detect what's already configured
HAS_KLING=false
HAS_HIGGSFIELD=false

if [ -n "$KLING_ACCESS_KEY" ] && [ -n "$KLING_SECRET_KEY" ]; then
    HAS_KLING=true
    echo "  [OK] Kling direct API credentials already set"
    echo "       Access Key: ${KLING_ACCESS_KEY:0:8}..."
fi

if command -v higgsfield &>/dev/null; then
    if higgsfield model list --json &>/dev/null; then
        HAS_HIGGSFIELD=true
        echo "  [OK] Higgsfield CLI installed and authenticated"
    else
        echo "  [..] Higgsfield CLI installed but not authenticated."
        echo "       Run: higgsfield auth login"
    fi
fi

echo ""

if [ "$HAS_KLING" = true ] || [ "$HAS_HIGGSFIELD" = true ]; then
    echo "  [OK] At least one backend is configured — you're ready to go."
    echo ""
    read -rp "  Configure another backend now? (y/N) " setup_more
    if [ "$setup_more" != "y" ] && [ "$setup_more" != "Y" ]; then
        SETUP_CHOICE="skip"
    else
        echo ""
        echo "  Which backend would you like to add?"
        echo "    1) Kling direct API (api keys)"
        echo "    2) Higgsfield CLI (login)"
        echo ""
        read -rp "  Enter 1 or 2 (or press enter to skip): " SETUP_CHOICE
    fi
else
    echo "  No backend configured yet. Pick one:"
    echo ""
    echo "    1) Kling direct API"
    echo "       - Get Access Key + Secret Key from https://app.klingai.com/global/dev"
    echo "       - Stored as env vars in your shell profile"
    echo ""
    echo "    2) Higgsfield CLI (recommended — also gives access to 15+ other models)"
    echo "       - Install: npm install -g @higgsfield-ai/cli"
    echo "       - Login:   higgsfield auth login"
    echo ""
    read -rp "  Enter 1 or 2 (or press enter to skip): " SETUP_CHOICE
fi

if [ "$SETUP_CHOICE" = "1" ]; then
    echo ""
    read -rp "  Enter your Kling AI Access Key: " access_key
    read -rp "  Enter your Kling AI Secret Key: " secret_key

    if [ -z "$access_key" ] || [ -z "$secret_key" ]; then
        echo ""
        echo "  [!!] Both keys are required. Skipping credential setup."
    else
        if [ -n "$SHELL_PROFILE" ]; then
            if grep -q "KLING_ACCESS_KEY" "$SHELL_PROFILE" 2>/dev/null; then
                sed -i.bak '/KLING_ACCESS_KEY/d' "$SHELL_PROFILE"
                sed -i.bak '/KLING_SECRET_KEY/d' "$SHELL_PROFILE"
            fi
            {
                echo ""
                echo "# Kling AI credentials (added by animate-character skill installer)"
                echo "export KLING_ACCESS_KEY=\"$access_key\""
                echo "export KLING_SECRET_KEY=\"$secret_key\""
            } >> "$SHELL_PROFILE"
            export KLING_ACCESS_KEY="$access_key"
            export KLING_SECRET_KEY="$secret_key"
            echo ""
            echo "  [OK] Credentials saved to $SHELL_PROFILE"
        else
            export KLING_ACCESS_KEY="$access_key"
            export KLING_SECRET_KEY="$secret_key"
            echo ""
            echo "  [OK] Credentials set for this session only."
            echo "  [!!] No shell profile found. Add these lines manually:"
            echo "       export KLING_ACCESS_KEY=\"$access_key\""
            echo "       export KLING_SECRET_KEY=\"$secret_key\""
        fi
    fi
elif [ "$SETUP_CHOICE" = "2" ]; then
    echo ""
    echo "  Higgsfield CLI setup is interactive — run these commands yourself:"
    echo ""
    echo "    npm install -g @higgsfield-ai/cli"
    echo "    higgsfield auth login"
    echo ""
    echo "  Then verify with:"
    echo ""
    echo "    higgsfield model list --json"
    echo ""
else
    echo ""
    echo "  [..] Skipping backend setup. Configure later before using the skill."
fi

# ---- Done ----

echo ""
echo "============================================"
echo "  Installation complete!"
echo "============================================"
echo ""
echo "  To use the skill, open Claude Code and type:"
echo ""
echo '  /animate-character ./character.png "idle animation, blinking"'
echo ""
echo "  Claude will analyze your image, generate an animation,"
echo "  and produce a sprite sheet PNG ready for your website."
echo ""
