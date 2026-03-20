# Animate Character Skill — Installer for Claude Code
# Installs the skill to your personal ~/.claude/skills directory
# and optionally saves your Kling AI API credentials

$ErrorActionPreference = "Stop"

$skipCredentials = $false
$SkillName = "animate-character"
$SourceDir = Join-Path $PSScriptRoot "skill"
$TargetDir = Join-Path $env:USERPROFILE ".claude" "skills" $SkillName

Write-Host ""
Write-Host "=== Animate Character Skill Installer ===" -ForegroundColor Cyan
Write-Host "    Kling AI animation for Claude Code"
Write-Host ""

# ---- Step 1: Check prerequisites ----

Write-Host "Step 1: Checking prerequisites..." -ForegroundColor Yellow
Write-Host ""

# Check ffmpeg
try {
    $null = & ffmpeg -version 2>&1
    Write-Host "  [OK] ffmpeg found" -ForegroundColor Green
} catch {
    Write-Host "  [!!] ffmpeg not found." -ForegroundColor Red
    Write-Host "       Download it from: https://ffmpeg.org/download.html" -ForegroundColor Red
    Write-Host "       After installing, restart this terminal and run the installer again." -ForegroundColor Red
    exit 1
}

# Check Node.js
try {
    $nodeVersion = & node --version 2>&1
    Write-Host "  [OK] Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "  [!!] Node.js not found." -ForegroundColor Red
    Write-Host "       Download it from: https://nodejs.org" -ForegroundColor Red
    Write-Host "       After installing, restart this terminal and run the installer again." -ForegroundColor Red
    exit 1
}

# Check source files exist
if (-not (Test-Path (Join-Path $SourceDir "SKILL.md"))) {
    Write-Host "  [!!] SKILL.md not found in $SourceDir" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ---- Step 2: Install the skill ----

Write-Host "Step 2: Installing skill files..." -ForegroundColor Yellow
Write-Host ""

if (Test-Path $TargetDir) {
    Write-Host "  [..] Removing previous installation" -ForegroundColor DarkYellow
    Remove-Item -Recurse -Force $TargetDir
}

Write-Host "  [..] Copying skill to $TargetDir"
Copy-Item -Recurse $SourceDir $TargetDir

if (-not (Test-Path (Join-Path $TargetDir "SKILL.md"))) {
    Write-Host "  [!!] Installation failed — files not copied" -ForegroundColor Red
    exit 1
}

Write-Host "  [OK] Skill files installed" -ForegroundColor Green
Write-Host ""

# ---- Step 3: API credentials ----

Write-Host "Step 3: Kling AI API credentials" -ForegroundColor Yellow
Write-Host ""

# Check if already set
$existingAccess = [Environment]::GetEnvironmentVariable("KLING_ACCESS_KEY", "User")
$existingSecret = [Environment]::GetEnvironmentVariable("KLING_SECRET_KEY", "User")

if ($existingAccess -and $existingSecret) {
    Write-Host "  [OK] Kling AI credentials already configured" -ForegroundColor Green
    Write-Host "       Access Key: $($existingAccess.Substring(0, [Math]::Min(8, $existingAccess.Length)))..." -ForegroundColor DarkGray
    Write-Host ""
    $reconfigure = Read-Host "  Do you want to update them? (y/N)"
    if ($reconfigure -ne 'y' -and $reconfigure -ne 'Y') {
        Write-Host "  [OK] Keeping existing credentials" -ForegroundColor Green
        Write-Host ""
        # Skip to done
        $skipCredentials = $true
    }
}

if (-not $skipCredentials) {
    Write-Host "  The skill needs Kling AI API credentials to generate animations." -ForegroundColor White
    Write-Host ""
    Write-Host '  If you do not have them yet:' -ForegroundColor White
    Write-Host '    1. Go to https://app.klingai.com/global/dev' -ForegroundColor Cyan
    Write-Host '    2. Sign up / log in' -ForegroundColor Cyan
    Write-Host '    3. Create an API key — you will get an Access Key + Secret Key' -ForegroundColor Cyan
    Write-Host ""

    $setupNow = Read-Host "  Do you want to enter your API keys now? (Y/n)"

    if ($setupNow -eq 'n' -or $setupNow -eq 'N') {
        Write-Host ""
        Write-Host "  [..] Skipping credentials setup. You can set them later:" -ForegroundColor DarkYellow
        Write-Host '       [Environment]::SetEnvironmentVariable("KLING_ACCESS_KEY", "your-key", "User")' -ForegroundColor DarkGray
        Write-Host '       [Environment]::SetEnvironmentVariable("KLING_SECRET_KEY", "your-key", "User")' -ForegroundColor DarkGray
        Write-Host "       Then restart your terminal." -ForegroundColor DarkGray
    } else {
        Write-Host ""
        $accessKey = Read-Host "  Enter your Kling AI Access Key"
        $secretKey = Read-Host "  Enter your Kling AI Secret Key"

        if (-not $accessKey -or -not $secretKey) {
            Write-Host ""
            Write-Host "  [!!] Both keys are required. Skipping credential setup." -ForegroundColor Red
            Write-Host "       You can run this installer again later to set them." -ForegroundColor DarkGray
        } else {
            # Save as persistent User environment variables
            [Environment]::SetEnvironmentVariable("KLING_ACCESS_KEY", $accessKey, "User")
            [Environment]::SetEnvironmentVariable("KLING_SECRET_KEY", $secretKey, "User")

            # Also set in current session so it works immediately
            $env:KLING_ACCESS_KEY = $accessKey
            $env:KLING_SECRET_KEY = $secretKey

            Write-Host ""
            Write-Host "  [OK] Credentials saved to your user environment variables" -ForegroundColor Green
            Write-Host "       They will persist across terminal sessions." -ForegroundColor DarkGray
        }
    }
}

# ---- Done ----

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Installation complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  To use the skill, open Claude Code and type:" -ForegroundColor White
Write-Host ""
Write-Host '  /animate-character ./character.png "idle animation, blinking"' -ForegroundColor Cyan
Write-Host ""
Write-Host "  Claude will analyze your image, generate an animation," -ForegroundColor DarkGray
Write-Host "  and produce a sprite sheet PNG ready for your website." -ForegroundColor DarkGray
Write-Host ""
