#!/bin/bash

# ====================================================================
# VERCEL CONFIGURATION SCRIPT
# ====================================================================
# Configura todas as variáveis de ambiente no Vercel
# Uso: ./02-configure-vercel.sh [production|preview]
# ====================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    log_error "Vercel CLI not installed"
    log_info "Install with: npm install -g vercel"
    exit 1
fi

# Get environment (production or preview)
ENVIRONMENT="${1:-production}"

if [[ "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "preview" ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    log_info "Usage: $0 [production|preview]"
    exit 1
fi

log_info "Configuring Vercel for environment: $ENVIRONMENT"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    log_error ".env.production not found"
    log_info "Copy .env.production.example and fill with real values"
    exit 1
fi

log_info "Loading environment variables from .env.production..."

# Function to set Vercel environment variable
set_vercel_env() {
    local key="$1"
    local value="$2"
    local env_type="$3"

    if [ -z "$value" ]; then
        log_warning "Skipping empty variable: $key"
        return
    fi

    log_info "Setting $key..."
    echo "$value" | vercel env add "$key" "$env_type" --force > /dev/null 2>&1

    if [ $? -eq 0 ]; then
        log_success "$key configured"
    else
        log_error "Failed to set $key"
    fi
}

# Read .env.production and set each variable
log_info "Configuring environment variables..."

# Critical variables
set_vercel_env "NODE_ENV" "production" "$ENVIRONMENT"
set_vercel_env "NEXT_PUBLIC_APP_URL" "$(grep NEXT_PUBLIC_APP_URL .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"

# Database
set_vercel_env "DATABASE_URL" "$(grep DATABASE_URL .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "DIRECT_URL" "$(grep DIRECT_URL .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"

# Supabase
set_vercel_env "NEXT_PUBLIC_SUPABASE_URL" "$(grep NEXT_PUBLIC_SUPABASE_URL .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "SUPABASE_SERVICE_ROLE_KEY" "$(grep SUPABASE_SERVICE_ROLE_KEY .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"

# Redis
set_vercel_env "REDIS_HOST" "$(grep REDIS_HOST .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "REDIS_PORT" "$(grep REDIS_PORT .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "REDIS_PASSWORD" "$(grep REDIS_PASSWORD .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"

# Authentication
set_vercel_env "NEXTAUTH_URL" "$(grep NEXTAUTH_URL .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "NEXTAUTH_SECRET" "$(grep NEXTAUTH_SECRET .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"

# API Keys
set_vercel_env "GOOGLE_API_KEY" "$(grep GOOGLE_API_KEY .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "JUDIT_API_KEY" "$(grep JUDIT_API_KEY .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"

# JUDIT URLs
set_vercel_env "JUDIT_REQUESTS_URL" "$(grep JUDIT_REQUESTS_URL .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "JUDIT_TRACKING_URL" "$(grep JUDIT_TRACKING_URL .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"

# Email
set_vercel_env "SMTP_HOST" "$(grep SMTP_HOST .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "SMTP_PORT" "$(grep SMTP_PORT .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "SMTP_USER" "$(grep SMTP_USER .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "SMTP_PASSWORD" "$(grep SMTP_PASSWORD .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "FROM_EMAIL" "$(grep FROM_EMAIL .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"

# Security & CORS
set_vercel_env "ALLOWED_ORIGINS" "$(grep ALLOWED_ORIGINS .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "CORS_CREDENTIALS" "$(grep CORS_CREDENTIALS .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "SECURITY_HEADERS_ENABLED" "$(grep SECURITY_HEADERS_ENABLED .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"

# Monitoring
set_vercel_env "LOG_LEVEL" "$(grep LOG_LEVEL .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "SENTRY_DSN" "$(grep SENTRY_DSN .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"

# Alerts
set_vercel_env "ALERTS_EMAIL_ENABLED" "$(grep ALERTS_EMAIL_ENABLED .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "ALERTS_EMAIL_TO" "$(grep ALERTS_EMAIL_TO .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"

# Workers
set_vercel_env "BULL_BOARD_ACCESS_TOKEN" "$(grep BULL_BOARD_ACCESS_TOKEN .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "SAVE_SYNC_STATS" "$(grep SAVE_SYNC_STATS .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"

# Feature flags
set_vercel_env "NEXT_PUBLIC_CLASSIC_DASHBOARD_ENABLED" "$(grep NEXT_PUBLIC_CLASSIC_DASHBOARD_ENABLED .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "NEXT_PUBLIC_PRO_FEATURES_ENABLED" "$(grep NEXT_PUBLIC_PRO_FEATURES_ENABLED .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "NEXT_PUBLIC_PROCESS_MONITORING_ENABLED" "$(grep NEXT_PUBLIC_PROCESS_MONITORING_ENABLED .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "NEXT_PUBLIC_ENABLE_ANALYTICS" "$(grep NEXT_PUBLIC_ENABLE_ANALYTICS .env.production | cut -d '=' -f2-)" "$ENVIRONMENT"
set_vercel_env "NEXT_PUBLIC_ENABLE_DEBUG" "false" "$ENVIRONMENT"

echo ""
log_success "✅ Vercel environment variables configured for $ENVIRONMENT"
log_info "Next steps:"
echo "  1. Verify variables in Vercel dashboard"
echo "  2. Run: vercel --prod (for production) or vercel (for preview)"
echo ""
