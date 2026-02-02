# Deploy via Docker Context Script
# Requirements: Docker Desktop installed, SSH access to VPS

$ErrorActionPreference = "Stop"

# Configuration
$SERVER_USER = "root"
$SERVER_HOST = "72.60.154.65"
$CONTEXT_NAME = "vps-remote"

Write-Host "=== Starting Docker Deployment ===" -ForegroundColor Green

# 1. Check/Setup Docker Context
Write-Host "Checking Docker Context..." -ForegroundColor Yellow
$contextExists = docker context ls -q | Select-String -Pattern "^$CONTEXT_NAME$"
if (-not $contextExists) {
    Write-Host "Creating Docker Context '$CONTEXT_NAME'..." -ForegroundColor Yellow
    # Note: This assumes SSH keys are set up. If not, it might fail or ask for password.
    docker context create $CONTEXT_NAME --docker "host=ssh://$SERVER_USER@$SERVER_HOST"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to create Docker context. Please ensure SSH passwordless login is configured." -ForegroundColor Red
        Write-Host "Run: ssh-copy-id $SERVER_USER@$SERVER_HOST (or manually add your public key to ~/.ssh/authorized_keys on the server)" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Docker Context '$CONTEXT_NAME' found." -ForegroundColor Green
}

# 2. Local Preparation (Versioning)
Write-Host "Updating Version..." -ForegroundColor Yellow
if (Test-Path "frontend") {
    Push-Location "frontend"
    try {
        cmd /c "npm version patch --no-git-tag-version"
        node generate-build-info.js
    } catch {
        Write-Host "Warning: Failed to update version info. Continuing..." -ForegroundColor Yellow
    }
    Pop-Location
}

# 3. Environment Variables
# Ensure .env exists for docker-compose to read locally and send values to remote
if (Test-Path ".env.prod") {
    Write-Host "Using .env.prod..." -ForegroundColor Yellow
    Copy-Item ".env.prod" ".env" -Force
}

# 4. Deploy using Docker Context
Write-Host "Deploying to VPS via Docker..." -ForegroundColor Yellow
Write-Host "Building and starting containers on remote host..." -ForegroundColor Cyan

# Use the remote context to build and run
docker --context $CONTEXT_NAME compose -f docker-compose.prod.yml up -d --build --remove-orphans

if ($LASTEXITCODE -eq 0) {
    Write-Host "=== Deployment Successful! ===" -ForegroundColor Green
    Write-Host "Check status with: docker --context $CONTEXT_NAME compose -f docker-compose.prod.yml ps" -ForegroundColor Cyan
} else {
    Write-Host "Deployment Failed." -ForegroundColor Red
    exit 1
}
