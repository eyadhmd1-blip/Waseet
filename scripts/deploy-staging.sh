#!/usr/bin/env bash
# ============================================================
# Waseet — Full Staging Deployment Orchestrator
# Usage: bash scripts/deploy-staging.sh [--skip-functions] [--skip-mobile]
#
# Stages:
#   1. Pre-flight checks (env vars, tools)
#   2. Install dependencies
#   3. Database migrations
#   4. Edge function deployment
#   5. Admin panel build + deploy
#   6. Mobile OTA update (no rebuild needed)
#   7. Post-deploy health check
#   8. Seed test data (optional)
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SKIP_FUNCTIONS=false
SKIP_MOBILE=false
SKIP_ADMIN=false
SEED_DATA=false

for arg in "$@"; do
  case "$arg" in
    --skip-functions) SKIP_FUNCTIONS=true ;;
    --skip-mobile)    SKIP_MOBILE=true    ;;
    --skip-admin)     SKIP_ADMIN=true     ;;
    --seed)           SEED_DATA=true      ;;
  esac
done

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[✓]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[✗]${NC}    $*"; exit 1; }
step()    { echo -e "\n${BOLD}${CYAN}══ STAGE $*${NC}"; }
divider() { echo -e "${BOLD}${CYAN}────────────────────────────────────────${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOY_START=$(date +%s)

# ────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Waseet — Staging Deployment v1.0.0-staging      ║${NC}"
echo -e "${BOLD}║   $(date '+%Y-%m-%d %H:%M:%S %Z')                         ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ────────────────────────────────────────────
step "1 — Pre-flight Checks"
divider

info "Running environment validator..."
bash "$SCRIPT_DIR/verify-env.sh" || error "Pre-flight checks failed. Fix errors above before deploying."

success "Pre-flight checks passed"

# ────────────────────────────────────────────
step "2 — Install Dependencies"
divider

info "Installing mobile dependencies..."
cd "$ROOT_DIR/mobile"
npm ci --prefer-offline --silent
success "mobile/node_modules ready ($(ls node_modules | wc -l | tr -d ' ') packages)"

info "Installing admin dependencies..."
cd "$ROOT_DIR/admin"
npm ci --prefer-offline --silent
success "admin/node_modules ready"

cd "$ROOT_DIR"

# ────────────────────────────────────────────
step "3 — Database Migrations"
divider

if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  warn "SUPABASE_PROJECT_REF not set as env var."
  warn "If not already linked, run: supabase link --project-ref YOUR_REF"
fi

info "Applying migrations (001 → 019)..."
if supabase db push --project-ref "${SUPABASE_PROJECT_REF:-}"; then
  success "All migrations applied"
else
  error "Migration failed — check Supabase logs"
fi

# ────────────────────────────────────────────
step "4 — Edge Functions"
divider

if $SKIP_FUNCTIONS; then
  warn "Skipping edge functions (--skip-functions)"
else
  info "Deploying all edge functions..."
  bash "$SCRIPT_DIR/deploy-functions.sh"
  success "Edge functions deployed"
fi

# ────────────────────────────────────────────
step "5 — Admin Panel"
divider

if $SKIP_ADMIN; then
  warn "Skipping admin panel (--skip-admin)"
else
  info "Building admin panel (Next.js)..."
  cd "$ROOT_DIR/admin"

  if npm run build; then
    success "Admin panel built successfully"
  else
    error "Admin panel build failed"
  fi

  # Deploy to Vercel if CLI is available
  if command -v vercel &>/dev/null; then
    info "Deploying admin to Vercel staging..."
    vercel deploy --prod 2>/dev/null && success "Admin deployed to Vercel" || \
      warn "Vercel deployment failed — start locally with: cd admin && npm run start"
  else
    warn "Vercel CLI not found — start admin manually: cd admin && npm run start"
  fi

  cd "$ROOT_DIR"
fi

# ────────────────────────────────────────────
step "6 — Mobile App OTA Update"
divider

if $SKIP_MOBILE; then
  warn "Skipping mobile update (--skip-mobile)"
else
  if command -v eas &>/dev/null; then
    info "Publishing OTA update to staging channel..."
    cd "$ROOT_DIR/mobile"

    GIT_HASH=$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")
    UPDATE_MSG="v1.0.0-staging | $(date '+%Y-%m-%d %H:%M') | ${GIT_HASH}"

    if eas update --branch staging --message "$UPDATE_MSG" --auto; then
      success "OTA update published: $UPDATE_MSG"
    else
      warn "OTA update failed — testers can still use Expo Go with the dev server"
    fi

    cd "$ROOT_DIR"
  else
    warn "EAS CLI not found — skipping OTA update"
    info "To start the app for staging testing:"
    info "  cd mobile && npx expo start --clear"
  fi
fi

# ────────────────────────────────────────────
step "7 — Seed Test Data"
divider

if $SEED_DATA; then
  info "Seeding staging test data..."
  if supabase db execute --file "$ROOT_DIR/supabase/seed-staging.sql" \
       --project-ref "${SUPABASE_PROJECT_REF:-}"; then
    success "Test data seeded"
  else
    warn "Seed data failed — run manually in Supabase SQL Editor"
  fi
else
  info "Skipping test data seed (add --seed flag to include)"
fi

# ────────────────────────────────────────────
step "8 — Post-Deploy Health Check"
divider

info "Running health check..."
bash "$SCRIPT_DIR/health-check.sh" || warn "Health check has failures — review above"

# ────────────────────────────────────────────
DEPLOY_END=$(date +%s)
DURATION=$((DEPLOY_END - DEPLOY_START))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   DEPLOYMENT COMPLETE                            ║${NC}"
echo -e "${BOLD}║   Duration: ${MINUTES}m ${SECONDS}s                               ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo -e "  1. Open Supabase Dashboard → Database → Replication"
echo -e "     Enable Realtime for: jobs, messages, support_messages, bids, requests"
echo -e ""
echo -e "  2. Set Edge Function secrets in Supabase Dashboard → Edge Functions → Secrets:"
echo -e "     ANTHROPIC_API_KEY, PADDLE_WEBHOOK_SECRET"
echo -e ""
echo -e "  3. Register Paddle webhook:"
echo -e "     https://YOUR_STAGING_PROJECT.supabase.co/functions/v1/paddle-webhook"
echo -e ""
echo -e "  4. Fill Paddle price IDs in:"
echo -e "     mobile/app/subscribe.tsx (line ~24)"
echo -e "     supabase/functions/paddle-webhook/index.ts (PRICE_TO_TIER map)"
echo -e ""
echo -e "  5. Share the staging APK with QA team:"
echo -e "     cd mobile && eas build --profile staging --platform android"
echo -e ""
echo -e "  6. Review STAGING.md → Test Scenarios for the full QA test plan"
echo ""
