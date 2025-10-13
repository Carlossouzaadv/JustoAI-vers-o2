#!/bin/bash

# ====================================================================
# ROLLBACK SCRIPT
# ====================================================================
# Script de rollback para reverter deploy em caso de problemas
# Uso: ./05-rollback.sh [deployment-url]
# ====================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

echo "============================================================"
log_warning "⚠️  ROLLBACK PROCEDURE"
echo "============================================================"
echo ""
log_warning "This will revert your production deployment to the previous version"
echo ""

# Confirm rollback
read -p "Are you sure you want to rollback? (yes/no): " confirm
if [[ $confirm != "yes" ]]; then
    log_info "Rollback cancelled"
    exit 0
fi

echo ""
log_info "Starting rollback procedure..."
echo ""

# ================================================================
# 1. GET CURRENT AND PREVIOUS DEPLOYMENTS
# ================================================================
log_info "Fetching deployment history..."

# Get list of production deployments
deployments=$(vercel ls --prod 2>&1)

if [[ $? -ne 0 ]]; then
    log_error "Failed to fetch deployments"
    log_error "$deployments"
    exit 1
fi

echo "$deployments"
echo ""

# ================================================================
# 2. IDENTIFY PREVIOUS DEPLOYMENT
# ================================================================
log_info "Identifying previous deployment..."

# If deployment URL provided, use it
if [ -n "$1" ]; then
    PREV_DEPLOYMENT="$1"
    log_info "Using provided deployment: $PREV_DEPLOYMENT"
else
    log_warning "No deployment URL provided"
    log_info "Please select the deployment to rollback to from the list above"
    read -p "Enter deployment URL: " PREV_DEPLOYMENT
fi

if [ -z "$PREV_DEPLOYMENT" ]; then
    log_error "No deployment URL provided"
    exit 1
fi

# ================================================================
# 3. CONFIRM ROLLBACK TARGET
# ================================================================
echo ""
log_warning "You are about to rollback to: $PREV_DEPLOYMENT"
read -p "Confirm rollback? (yes/no): " final_confirm

if [[ $final_confirm != "yes" ]]; then
    log_info "Rollback cancelled"
    exit 0
fi

# ================================================================
# 4. PERFORM ROLLBACK
# ================================================================
echo ""
log_info "Rolling back to previous deployment..."

vercel promote "$PREV_DEPLOYMENT" --yes

if [[ $? -eq 0 ]]; then
    log_success "✅ Rollback completed successfully"
else
    log_error "❌ Rollback failed"
    exit 1
fi

# ================================================================
# 5. VERIFY ROLLBACK
# ================================================================
echo ""
log_info "Verifying rollback..."

sleep 5

# Get current production deployment
current=$(vercel ls --prod | grep "justoai-v2" | head -1)

log_info "Current production deployment: $current"

# ================================================================
# 6. POST-ROLLBACK CHECKS
# ================================================================
echo ""
log_info "Running post-rollback checks..."

# Check if application is responding
APP_URL=$(vercel ls --prod | grep -oP 'https://[^\s]+' | head -1)

if [ -n "$APP_URL" ]; then
    log_info "Testing application at: $APP_URL"

    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$APP_URL" || echo "000")

    if [[ $HTTP_STATUS == "200" ]]; then
        log_success "✅ Application is responding (HTTP $HTTP_STATUS)"
    else
        log_error "❌ Application returned HTTP $HTTP_STATUS"
    fi
else
    log_warning "⚠️  Could not determine app URL for testing"
fi

# ================================================================
# 7. RECOMMENDATIONS
# ================================================================
echo ""
echo "============================================================"
log_success "ROLLBACK COMPLETED"
echo "============================================================"
echo ""
log_info "Next steps:"
echo "  1. Verify application functionality manually"
echo "  2. Check application logs: vercel logs"
echo "  3. Monitor error rates in Sentry (if configured)"
echo "  4. Investigate root cause of the issue"
echo "  5. Fix the issue before attempting new deployment"
echo ""
log_warning "Remember: Rollback is a temporary solution"
log_info "Address the root cause before redeploying"
echo ""

# ================================================================
# 8. LOG ROLLBACK EVENT
# ================================================================
ROLLBACK_LOG="deploy-scripts/rollback.log"
echo "[$(date)] Rollback to $PREV_DEPLOYMENT" >> "$ROLLBACK_LOG"
log_info "Rollback event logged to: $ROLLBACK_LOG"
