# VERCEL ENVIRONMENT VARIABLES CONFIGURATION SCRIPT
# Simple version without special characters

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "JUSTOAI V2 - VERCEL ENV CONFIGURATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Vercel CLI
try {
    $null = Get-Command vercel -ErrorAction Stop
    Write-Host "[OK] Vercel CLI is installed" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Vercel CLI is not installed" -ForegroundColor Red
    Write-Host "Install it with: npm install -g vercel" -ForegroundColor Yellow
    exit 1
}

# Check .env.production
if (-not (Test-Path ".env.production")) {
    Write-Host "[ERROR] .env.production file not found" -ForegroundColor Red
    Write-Host "Please create .env.production with your production environment variables" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] .env.production file found" -ForegroundColor Green
Write-Host ""

# Prompt for confirmation
Write-Host "This script will configure environment variables in Vercel." -ForegroundColor Yellow
Write-Host "Make sure you have run 'vercel link' to link your project." -ForegroundColor Yellow
Write-Host ""
$confirmation = Read-Host "Continue? (y/n)"

if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
    Write-Host "Aborted by user" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURING ENVIRONMENT VARIABLES" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to add environment variable
function Add-VercelEnvVar {
    param(
        [string]$Key,
        [string]$Value,
        [string]$EnvType = "production"
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        Write-Host "[SKIP] $Key (empty value)" -ForegroundColor Yellow
        return
    }

    # Remove quotes
    $Value = $Value.Trim('"').Trim("'")

    Write-Host "Setting $Key..." -ForegroundColor Cyan

    try {
        # Try to add the variable
        $Value | vercel env add $Key $EnvType 2>&1 | Out-Null
        Write-Host "[OK] $Key configured for $EnvType" -ForegroundColor Green
    } catch {
        # If exists, try to update
        Write-Host "[WARN] $Key already exists, updating..." -ForegroundColor Yellow
        try {
            vercel env rm $Key $EnvType --yes 2>&1 | Out-Null
        } catch {}

        try {
            $Value | vercel env add $Key $EnvType 2>&1 | Out-Null
            Write-Host "[OK] $Key updated for $EnvType" -ForegroundColor Green
        } catch {
            Write-Host "[ERROR] Failed to set $Key" -ForegroundColor Red
        }
    }
}

# Read and process .env.production
$envContent = Get-Content ".env.production"
$count = 0

foreach ($line in $envContent) {
    # Skip comments and empty lines
    if ($line -match '^\s*#' -or [string]::IsNullOrWhiteSpace($line)) {
        continue
    }

    # Parse key=value
    if ($line -match '^([^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()

        # Skip if no value
        if ([string]::IsNullOrWhiteSpace($value)) {
            continue
        }

        # Add to Vercel (production)
        Add-VercelEnvVar -Key $key -Value $value -EnvType "production"
        $count++

        # Also add public variables to preview
        if ($key -like "NEXT_PUBLIC_*") {
            Add-VercelEnvVar -Key $key -Value $value -EnvType "preview"
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VERIFICATION" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Listing all environment variables in Vercel..." -ForegroundColor Cyan
vercel env ls

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURATION COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[OK] All $count environment variables have been configured in Vercel" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Verify the variables above"
Write-Host "2. Run: npm run deploy:check"
Write-Host "3. Run: npm run deploy:prod"
Write-Host ""
