################################################################################
# VERCEL ENVIRONMENT VARIABLES CONFIGURATION SCRIPT (PowerShell)
################################################################################
# This script automatically configures all required environment variables
# in your Vercel project for production deployment.
#
# PREREQUISITES:
# 1. Install Vercel CLI: npm install -g vercel
# 2. Login to Vercel: vercel login
# 3. Link your project: vercel link
# 4. Have your .env.production file ready with all values
#
# USAGE:
#   .\deploy-scripts\02-configure-vercel-env.ps1
################################################################################

$ErrorActionPreference = "Stop"

# Helper functions
function Log-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Blue
}

function Log-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Log-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Log-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Log-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host $Title -ForegroundColor Blue
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host ""
}

# Check if Vercel CLI is installed
try {
    $null = Get-Command vercel -ErrorAction Stop
    Log-Success "Vercel CLI is installed"
} catch {
    Log-Error "Vercel CLI is not installed"
    Write-Host "Install it with: npm install -g vercel"
    exit 1
}

# Check if .env.production exists
if (-not (Test-Path ".env.production")) {
    Log-Error ".env.production file not found"
    Write-Host "Please create .env.production with your production environment variables"
    exit 1
}

Log-Success ".env.production file found"

Log-Section "🚀 JUSTOAI V2 - VERCEL ENVIRONMENT CONFIGURATION"

# Prompt for confirmation
Write-Host "This script will configure environment variables in Vercel." -ForegroundColor Yellow
Write-Host "Make sure you have run 'vercel link' to link your project." -ForegroundColor Yellow
Write-Host ""
$confirmation = Read-Host "Continue? (y/n)"

if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
    Log-Warning "Aborted by user"
    exit 0
}

Log-Section "📋 CONFIGURING ENVIRONMENT VARIABLES"

# Function to add environment variable to Vercel
function Add-VercelEnvVar {
    param(
        [string]$Key,
        [string]$Value,
        [string]$EnvType = "production"
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        Log-Warning "Skipping $Key (empty value)"
        return
    }

    # Remove quotes from value if present
    $Value = $Value.Trim('"')

    Write-Host "Setting $Key..."

    try {
        # Try to add the variable
        $Value | vercel env add $Key $EnvType 2>&1 | Out-Null
        Log-Success "$Key configured for $EnvType"
    } catch {
        # If variable already exists, try to remove and re-add
        Log-Warning "$Key already exists, updating..."
        try {
            vercel env rm $Key $EnvType --yes 2>&1 | Out-Null
        } catch {
            # Ignore error if doesn't exist
        }

        try {
            $Value | vercel env add $Key $EnvType 2>&1 | Out-Null
            Log-Success "$Key updated for $EnvType"
        } catch {
            Log-Error "Failed to set $Key"
        }
    }
}

# Read .env.production and set each variable
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

        # Add to Vercel (production only by default)
        Add-VercelEnvVar -Key $key -Value $value -EnvType "production"
        $count++

        # Also add public variables to preview
        if ($key -like "NEXT_PUBLIC_*") {
            Add-VercelEnvVar -Key $key -Value $value -EnvType "preview"
        }
    }
}

Log-Section "🔍 VERIFICATION"

Log-Info "Listing all environment variables in Vercel..."
vercel env ls

Log-Section "✅ CONFIGURATION COMPLETE"

Log-Success "All $count environment variables have been configured in Vercel"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Verify the variables above"
Write-Host "2. Run: npm run deploy:check"
Write-Host "3. Run: npm run deploy:prod"
Write-Host ""
Log-Info "You can also configure variables manually at:"
Write-Host 'https://vercel.com/[your-team]/[your-project]/settings/environment-variables'
