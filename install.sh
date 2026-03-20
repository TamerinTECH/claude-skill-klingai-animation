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
echo "    Kling AI animation for Claude Code"
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

# ---- Step 3: API credentials ----

echo "Step 3: Kling AI API credentials"
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

# Check if already set
SKIP_CREDENTIALS=false

if [ -n "$KLING_ACCESS_KEY" ] && [ -n "$KLING_SECRET_KEY" ]; then
    echo "  [OK] Kling AI credentials already configured"
    echo "       Access Key: ${KLING_ACCESS_KEY:0:8}..."
    echo ""
    read -rp "  Do you want to update them? (y/N) " reconfigure
    if [ "$reconfigure" != "y" ] && [ "$reconfigure" != "Y" ]; then
        echo "  [OK] Keeping existing credentials"
        SKIP_CREDENTIALS=true
    fi
fi

if [ "$SKIP_CREDENTIALS" = false ]; then
    echo "  The skill needs Kling AI API credentials to generate animations."
    echo ""
    echo "  If you don't have them yet:"
    echo "    1. Go to https://app.klingai.com/global/dev"
    echo "    2. Sign up / log in"
    echo "    3. Create an API key (you'll get an Access Key + Secret Key)"
    echo ""

    read -rp "  Do you want to enter your API keys now? (Y/n) " setup_now

    if [ "$setup_now" = "n" ] || [ "$setup_now" = "N" ]; then
        echo ""
        echo "  [..] Skipping credentials setup. You can set them later by adding"
        echo "       these lines to your shell profile ($SHELL_PROFILE):"
        echo ""
        echo '       export KLING_ACCESS_KEY="your-access-key"'
        echo '       export KLING_SECRET_KEY="your-secret-key"'
        echo ""
        echo "       Then restart your terminal."
    else
        echo ""
        read -rp "  Enter your Kling AI Access Key: " access_key
        read -rp "  Enter your Kling AI Secret Key: " secret_key

        if [ -z "$access_key" ] || [ -z "$secret_key" ]; then
            echo ""
            echo "  [!!] Both keys are required. Skipping credential setup."
            echo "       You can run this installer again later to set them."
        else
            if [ -n "$SHELL_PROFILE" ]; then
                # Remove old entries if present
                if grep -q "KLING_ACCESS_KEY" "$SHELL_PROFILE" 2>/dev/null; then
                    sed -i.bak '/KLING_ACCESS_KEY/d' "$SHELL_PROFILE"
                    sed -i.bak '/KLING_SECRET_KEY/d' "$SHELL_PROFILE"
                fi

                # Append to shell profile
                echo "" >> "$SHELL_PROFILE"
                echo "# Kling AI credentials (added by animate-character skill installer)" >> "$SHELL_PROFILE"
                echo "export KLING_ACCESS_KEY=\"$access_key\"" >> "$SHELL_PROFILE"
                echo "export KLING_SECRET_KEY=\"$secret_key\"" >> "$SHELL_PROFILE"

                # Also export in current session
                export KLING_ACCESS_KEY="$access_key"
                export KLING_SECRET_KEY="$secret_key"

                echo ""
                echo "  [OK] Credentials saved to $SHELL_PROFILE"
                echo "       They will persist across terminal sessions."
            else
                # No profile found, export for current session only
                export KLING_ACCESS_KEY="$access_key"
                export KLING_SECRET_KEY="$secret_key"

                echo ""
                echo "  [OK] Credentials set for this session."
                echo "  [!!] Could not find a shell profile to save them permanently."
                echo "       Add these lines manually to your shell profile:"
                echo ""
                echo "       export KLING_ACCESS_KEY=\"$access_key\""
                echo "       export KLING_SECRET_KEY=\"$secret_key\""
            fi
        fi
    fi
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
