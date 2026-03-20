# Animate Character Skill — Installer for Claude Code
# Installs the skill to your personal ~/.claude/skills directory

$ErrorActionPreference = "Stop"

$SkillName = "animate-character"
$SourceDir = Join-Path $PSScriptRoot "skill"
$TargetDir = Join-Path $env:USERPROFILE ".claude" "skills" $SkillName

# Check prerequisites
Write-Host "=== Animate Character Skill Installer ===" -ForegroundColor Cyan
Write-Host ""

# Check ffmpeg
try {
    $null = & ffmpeg -version 2>&1
    Write-Host "[OK] ffmpeg found" -ForegroundColor Green
} catch {
    Write-Host "[!!] ffmpeg not found. Install from https://ffmpeg.org/download.html" -ForegroundColor Red
    exit 1
}

# Check Node.js
try {
    $nodeVersion = & node --version 2>&1
    Write-Host "[OK] Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "[!!] Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check source files exist
if (-not (Test-Path (Join-Path $SourceDir "SKILL.md"))) {
    Write-Host "[!!] SKILL.md not found in $SourceDir" -ForegroundColor Red
    exit 1
}

# Create target directory
if (Test-Path $TargetDir) {
    Write-Host "[..] Removing existing installation at $TargetDir" -ForegroundColor Yellow
    Remove-Item -Recurse -Force $TargetDir
}

Write-Host "[..] Installing to $TargetDir"
Copy-Item -Recurse $SourceDir $TargetDir

# Verify installation
if (Test-Path (Join-Path $TargetDir "SKILL.md")) {
    Write-Host ""
    Write-Host "[OK] Skill installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Usage in Claude Code:" -ForegroundColor Cyan
    Write-Host "  /animate-character ./character.png `"idle animation, blinking`""
    Write-Host ""
    Write-Host "Set your Kling AI credentials:" -ForegroundColor Cyan
    Write-Host '  $env:KLING_ACCESS_KEY = "your-access-key"'
    Write-Host '  $env:KLING_SECRET_KEY = "your-secret-key"'
    Write-Host ""
    Write-Host "Get API keys from: https://app.klingai.com/global/dev"
} else {
    Write-Host "[!!] Installation failed" -ForegroundColor Red
    exit 1
}
