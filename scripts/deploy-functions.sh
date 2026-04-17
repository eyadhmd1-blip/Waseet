#!/usr/bin/env bash
# ============================================================
# Waseet — Edge Functions Deployment Script
# Usage: bash scripts/deploy-functions.sh [--dry-run]
# Deploys all 10 Supabase Edge Functions in the correct order.
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step()    { echo -e "\n${BOLD}${CYAN}▶ $*${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
FUNCTIONS_DIR="$ROOT_DIR/supabase/functions"

# Check supabase CLI
command -v supabase &>/dev/null || error "supabase CLI not found. Install: npm install -g supabase"

echo ""
echo -e "${BOLD}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Waseet — Edge Functions Deployment (Staging) ║${NC}"
echo -e "${BOLD}╚═══════════════════════════════════════════════╝${NC}"
$DRY_RUN && echo -e "${YELLOW}[DRY-RUN MODE — no actual deployments]${NC}"
echo ""

deploy_fn() {
  local name="$1"
  shift
  local extra_args=("$@")

  if [[ ! -d "$FUNCTIONS_DIR/$name" ]]; then
    warn "Function directory not found: $FUNCTIONS_DIR/$name — skipping"
    return 0
  fi

  if $DRY_RUN; then
    info "[DRY-RUN] Would deploy: supabase functions deploy $name ${extra_args[*]:-}"
    return 0
  fi

  info "Deploying $name..."
  if supabase functions deploy "$name" "${extra_args[@]}" --project-ref "${SUPABASE_PROJECT_REF:-}"; then
    success "Deployed: $name"
  else
    error "Failed to deploy: $name"
  fi
}

# Order matters: dependencies first
step "1/9 — ai-price-suggest"
deploy_fn "ai-price-suggest"

step "2/9 — notification-engine"
deploy_fn "notification-engine"

step "3/9 — notification-dispatcher (with cron schedule)"
deploy_fn "notification-dispatcher" "--schedule" "0 6 * * *"

step "4/9 — notify-provider-bid-accepted"
deploy_fn "notify-provider-bid-accepted"

step "5/9 — notify-urgent"
deploy_fn "notify-urgent"

step "6/9 — paddle-webhook"
deploy_fn "paddle-webhook"

step "7/9 — confirm-job"
deploy_fn "confirm-job"

step "8/9 — send-confirm-notification"
deploy_fn "send-confirm-notification"

step "9/9 — provider-page"
deploy_fn "provider-page"

echo ""
if $DRY_RUN; then
  echo -e "${YELLOW}${BOLD}DRY-RUN complete — no functions were actually deployed.${NC}"
else
  echo -e "${GREEN}${BOLD}All edge functions deployed successfully.${NC}"
  echo ""
  info "Next: Verify deployment with:"
  info "  supabase functions list --project-ref \${SUPABASE_PROJECT_REF}"
  info ""
  info "Set required secrets in Supabase Dashboard → Edge Functions → Secrets:"
  info "  ANTHROPIC_API_KEY     (for ai-price-suggest)"
  info "  PADDLE_WEBHOOK_SECRET (for paddle-webhook)"
fi
