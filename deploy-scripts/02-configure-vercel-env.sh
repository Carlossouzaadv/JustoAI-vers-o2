#!/bin/bash

################################################################################
# VERCEL ENVIRONMENT VARIABLES CONFIGURATION SCRIPT
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
#   bash deploy-scripts/02-configure-vercel-env.sh
#
# Or make it executable and run:
#   chmod +x deploy-scripts/02-configure-vercel-env.sh
#   ./deploy-scripts/02-configure-vercel-env.sh
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ ${1}${NC}"
}

log_success() {
    echo -e "${GREEN}✅ ${1}${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  ${1}${NC}"
}

log_error() {
    echo -e "${RED}❌ ${1}${NC}"
}

log_section() {
    echo ""
    echo "========================================"
    echo -e "${BLUE}${1}${NC}"
    echo "========================================"
    echo ""
}

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    log_error "Vercel CLI is not installed"
    echo "Install it with: npm install -g vercel"
    exit 1
fi

log_success "Vercel CLI is installed"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    log_error ".env.production file not found"
    echo "Please create .env.production with your production environment variables"
    exit 1
fi

log_success ".env.production file found"

log_section "🚀 JUSTOAI V2 - VERCEL ENVIRONMENT CONFIGURATION"

# Prompt for confirmation
echo -e "${YELLOW}This script will configure environment variables in Vercel.${NC}"
echo -e "${YELLOW}Make sure you have run 'vercel link' to link your project.${NC}"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_warning "Aborted by user"
    exit 0
fi

log_section "📋 CONFIGURING ENVIRONMENT VARIABLES"

# Function to add environment variable to Vercel
add_env_var() {
    local key=$1
    local value=$2
    local env_type=${3:-"production"}  # production, preview, or development

    if [ -z "$value" ]; then
        log_warning "Skipping $key (empty value)"
        return 0
    fi

    # Remove quotes from value if present
    value=$(echo "$value" | sed 's/^"//; s/"$//')

    echo "Setting $key..."

    # Set for production environment
    if vercel env add "$key" "$env_type" <<< "$value" 2>/dev/null; then
        log_success "$key configured for $env_type"
    else
        # If variable already exists, try to remove and re-add
        log_warning "$key already exists, updating..."
        vercel env rm "$key" "$env_type" --yes 2>/dev/null || true
        if vercel env add "$key" "$env_type" <<< "$value" 2>/dev/null; then
            log_success "$key updated for $env_type"
        else
            log_error "Failed to set $key"
        fi
    fi
}

# Read .env.production and set each variable
while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ $key =~ ^#.*$ ]] && continue
    [[ -z $key ]] && continue

    # Remove leading/trailing whitespace
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)

    # Skip if no value
    [[ -z $value ]] && continue

    # Add to Vercel (production only by default)
    add_env_var "$key" "$value" "production"

    # Also add public variables to preview
    if [[ $key == NEXT_PUBLIC_* ]]; then
        add_env_var "$key" "$value" "preview"
    fi

done < .env.production

log_section "🔍 VERIFICATION"

log_info "Listing all environment variables in Vercel..."
vercel env ls

log_section "✅ CONFIGURATION COMPLETE"

log_success "All environment variables have been configured in Vercel"
echo ""
echo "Next steps:"
echo "1. Verify the variables above"
echo "2. Run: npm run deploy:check"
echo "3. Run: npm run deploy:prod"
echo ""
log_info "You can also configure variables manually at:"
echo "https://vercel.com/[your-team]/[your-project]/settings/environment-variables"
