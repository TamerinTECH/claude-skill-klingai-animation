# Animate Character Skill - Installer for Claude Code
# Installs the skill to your personal ~/.claude/skills directory
# and optionally saves your Kling AI API credentials

$ErrorActionPreference = "Stop"

$skipCredentials = $false
$SkillName = "animate-character"
$SourceDir = Join-Path $PSScriptRoot "skill"
$TargetDir = Join-Path (Join-Path (Join-Path $env:USERPROFILE ".claude") "skills") $SkillName

Write-Host ""
Write-Host "=== Animate Character Skill Installer ===" -ForegroundColor Cyan
Write-Host "    Image-to-sprite-sheet animation for Claude Code"
Write-Host "    Backends: Kling direct API or Higgsfield CLI"
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
    Write-Host "  [!!] Installation failed - files not copied" -ForegroundColor Red
    exit 1
}

Write-Host "  [OK] Skill files installed" -ForegroundColor Green
Write-Host ""

# ---- Step 3: Configure a video-generation backend ----

Write-Host "Step 3: Configure a video-generation backend" -ForegroundColor Yellow
Write-Host ""

$hasKling = $false
$hasHiggsfield = $false

$existingAccess = [Environment]::GetEnvironmentVariable("KLING_ACCESS_KEY", "User")
$existingSecret = [Environment]::GetEnvironmentVariable("KLING_SECRET_KEY", "User")
if ($existingAccess -and $existingSecret) {
    $hasKling = $true
    Write-Host "  [OK] Kling direct API credentials already set" -ForegroundColor Green
    Write-Host "       Access Key: $($existingAccess.Substring(0, [Math]::Min(8, $existingAccess.Length)))..." -ForegroundColor DarkGray
}

$higgsfieldCmd = Get-Command higgsfield -ErrorAction SilentlyContinue
if ($higgsfieldCmd) {
    $modelListOk = $false
    try {
        $null = & higgsfield model list --json 2>&1
        if ($LASTEXITCODE -eq 0) { $modelListOk = $true }
    } catch {}
    if ($modelListOk) {
        $hasHiggsfield = $true
        Write-Host "  [OK] Higgsfield CLI installed and authenticated" -ForegroundColor Green
    } else {
        Write-Host "  [..] Higgsfield CLI installed but not authenticated." -ForegroundColor DarkYellow
        Write-Host "       Run: higgsfield auth login" -ForegroundColor DarkGray
    }
}

Write-Host ""

if ($hasKling -or $hasHiggsfield) {
    Write-Host "  [OK] At least one backend is configured - you're ready to go." -ForegroundColor Green
    Write-Host ""
    $setupMore = Read-Host "  Configure another backend now? (y/N)"
    if ($setupMore -ne "y" -and $setupMore -ne "Y") {
        $setupChoice = "skip"
    } else {
        Write-Host ""
        Write-Host "  Which backend would you like to add?" -ForegroundColor White
        Write-Host "    1) Kling direct API (api keys)" -ForegroundColor Cyan
        Write-Host "    2) Higgsfield CLI (login)" -ForegroundColor Cyan
        Write-Host ""
        $setupChoice = Read-Host "  Enter 1 or 2 (or press enter to skip)"
    }
} else {
    Write-Host "  No backend configured yet. Pick one:" -ForegroundColor White
    Write-Host ""
    Write-Host "    1) Kling direct API" -ForegroundColor Cyan
    Write-Host "       - Get Access Key + Secret Key from https://app.klingai.com/global/dev" -ForegroundColor DarkGray
    Write-Host "       - Stored as User environment variables" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "    2) Higgsfield CLI (recommended - also gives access to 15+ other models)" -ForegroundColor Cyan
    Write-Host "       - Install: npm install -g @higgsfield-ai/cli" -ForegroundColor DarkGray
    Write-Host "       - Login:   higgsfield auth login" -ForegroundColor DarkGray
    Write-Host ""
    $setupChoice = Read-Host "  Enter 1 or 2 (or press enter to skip)"
}

if ($setupChoice -eq "1") {
    Write-Host ""
    $accessKey = Read-Host "  Enter your Kling AI Access Key"
    $secretKey = Read-Host "  Enter your Kling AI Secret Key"

    if (-not $accessKey -or -not $secretKey) {
        Write-Host ""
        Write-Host "  [!!] Both keys are required. Skipping credential setup." -ForegroundColor Red
    } else {
        [Environment]::SetEnvironmentVariable("KLING_ACCESS_KEY", $accessKey, "User")
        [Environment]::SetEnvironmentVariable("KLING_SECRET_KEY", $secretKey, "User")
        $env:KLING_ACCESS_KEY = $accessKey
        $env:KLING_SECRET_KEY = $secretKey
        Write-Host ""
        Write-Host "  [OK] Credentials saved to your user environment variables" -ForegroundColor Green
    }
} elseif ($setupChoice -eq "2") {
    Write-Host ""
    Write-Host "  Higgsfield CLI setup is interactive - run these commands yourself:" -ForegroundColor White
    Write-Host ""
    Write-Host "    npm install -g @higgsfield-ai/cli" -ForegroundColor Cyan
    Write-Host "    higgsfield auth login" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Then verify with:" -ForegroundColor White
    Write-Host ""
    Write-Host "    higgsfield model list --json" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "  [..] Skipping backend setup. Configure later before using the skill." -ForegroundColor DarkYellow
}

# ---- Done ----

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Installation complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  To use the skill, open Claude Code and type:" -ForegroundColor White
Write-Host ""
Write-Host "  /animate-character ./character.png `"idle animation, blinking`"" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Claude will analyze your image, generate an animation," -ForegroundColor DarkGray
Write-Host "  and produce a sprite sheet PNG ready for your website." -ForegroundColor DarkGray
Write-Host ""
