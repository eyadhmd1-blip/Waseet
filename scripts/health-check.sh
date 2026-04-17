#!/usr/bin/env bash
# ============================================================
# Waseet — Post-Deploy Health Check
# Usage: bash scripts/health-check.sh
# Verifies all staging services are reachable and operational.
# Exit 0 = all checks passed (or warnings only)
# Exit 1 = one or more critical checks failed
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

FAILURES=0
WARNINGS=0
PASSED=0

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()      { echo -e "${GREEN}[✓]${NC}    $*"; PASSED=$((PASSED+1)); }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; WARNINGS=$((WARNINGS+1)); }
fail()    { echo -e "${RED}[✗]${NC}    $*"; FAILURES=$((FAILURES+1)); }
header()  { echo -e "\n${BOLD}${CYAN}── $* ──────────────────────────${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Load env ────────────────────────────────────────────────
MOBILE_ENV="$ROOT_DIR/mobile/.env.local"
if [[ -f "$MOBILE_ENV" ]]; then
  SUPABASE_URL=$(grep -E "^EXPO_PUBLIC_SUPABASE_URL=" "$MOBILE_ENV" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
  ANON_KEY=$(grep -E "^EXPO_PUBLIC_SUPABASE_ANON_KEY=" "$MOBILE_ENV" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
else
  SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-}"
  ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}"
fi

ADMIN_ENV="$ROOT_DIR/admin/.env.local"
if [[ -f "$ADMIN_ENV" ]]; then
  SERVICE_KEY=$(grep -E "^SUPABASE_SERVICE_ROLE_KEY=" "$ADMIN_ENV" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
else
  SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
fi

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Waseet — Staging Health Check                  ║${NC}"
echo -e "${BOLD}║   $(date '+%Y-%m-%d %H:%M:%S %Z')                         ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ────────────────────────────────────────────
header "1. Supabase API Reachability"
# ────────────────────────────────────────────

if [[ -z "${SUPABASE_URL:-}" ]] || [[ "$SUPABASE_URL" == *"YOUR_"* ]]; then
  warn "SUPABASE_URL not configured — skipping API checks"
else
  # REST API health — root returns 401 (unauthenticated) which confirms it's up
  HTTP=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" \
    "${SUPABASE_URL}/rest/v1/" \
    -H "apikey: ${ANON_KEY:-}" \
    -H "Authorization: Bearer ${ANON_KEY:-}" 2>/dev/null || echo "000")
  if [[ "$HTTP" == "200" ]] || [[ "$HTTP" == "401" ]] || [[ "$HTTP" == "404" ]]; then
    ok "Supabase REST API reachable (HTTP $HTTP)"
  else
    fail "Supabase REST API returned HTTP $HTTP (expected 200/401)"
  fi

  # Auth endpoint
  HTTP=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" \
    "${SUPABASE_URL}/auth/v1/health" \
    -H "apikey: ${ANON_KEY:-}" 2>/dev/null || echo "000")
  if [[ "$HTTP" == "200" ]]; then
    ok "Supabase Auth service healthy (HTTP $HTTP)"
  else
    warn "Supabase Auth health returned HTTP $HTTP"
  fi

  # Storage endpoint
  HTTP=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" \
    "${SUPABASE_URL}/storage/v1/health" \
    -H "apikey: ${ANON_KEY:-}" 2>/dev/null || echo "000")
  if [[ "$HTTP" == "200" ]]; then
    ok "Supabase Storage healthy (HTTP $HTTP)"
  else
    warn "Supabase Storage health returned HTTP $HTTP"
  fi
fi

# ────────────────────────────────────────────
header "2. Database Table Access (via anon key)"
# ────────────────────────────────────────────

if [[ -z "${SUPABASE_URL:-}" ]] || [[ -z "${ANON_KEY:-}" ]] || [[ "$SUPABASE_URL" == *"YOUR_"* ]]; then
  warn "Supabase credentials not configured — skipping table checks"
else
  check_table() {
    local table="$1"
    local HTTP
    HTTP=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" \
      "${SUPABASE_URL}/rest/v1/${table}?limit=1" \
      -H "apikey: ${ANON_KEY}" \
      -H "Authorization: Bearer ${ANON_KEY}" 2>/dev/null || echo "000")
    if [[ "$HTTP" == "200" ]]; then
      ok "Table '${table}' accessible (HTTP $HTTP)"
    elif [[ "$HTTP" == "406" ]] || [[ "$HTTP" == "401" ]]; then
      # 406 = RLS denying anon, which means the table exists and RLS is working
      ok "Table '${table}' exists, RLS active (HTTP $HTTP — expected)"
    else
      fail "Table '${table}' returned HTTP $HTTP"
    fi
  }

  check_table "users"
  check_table "providers"
  check_table "requests"
  check_table "bids"
  check_table "jobs"
  check_table "messages"
  check_table "support_tickets"
  check_table "service_categories"
  check_table "subscriptions"
fi

# ────────────────────────────────────────────
header "3. Edge Functions"
# ────────────────────────────────────────────

if [[ -z "${SUPABASE_URL:-}" ]] || [[ "$SUPABASE_URL" == *"YOUR_"* ]]; then
  warn "SUPABASE_URL not configured — skipping edge function checks"
else
  check_function() {
    local fn_name="$1"
    local HTTP
    # OPTIONS preflight — returns 200 or 204 without requiring auth/body
    HTTP=$(curl -sf --max-time 15 -o /dev/null -w "%{http_code}" -X OPTIONS \
      "${SUPABASE_URL}/functions/v1/${fn_name}" \
      -H "apikey: ${ANON_KEY:-}" 2>/dev/null || echo "000")
    if [[ "$HTTP" == "200" ]] || [[ "$HTTP" == "204" ]] || [[ "$HTTP" == "405" ]]; then
      ok "Edge function '${fn_name}' deployed (HTTP $HTTP)"
    elif [[ "$HTTP" == "404" ]]; then
      fail "Edge function '${fn_name}' NOT FOUND (HTTP 404) — not deployed"
    else
      warn "Edge function '${fn_name}' returned HTTP $HTTP (may need secrets)"
    fi
  }

  check_function "ai-price-suggest"
  check_function "notification-engine"
  check_function "notification-dispatcher"
  check_function "notify-provider-bid-accepted"
  check_function "notify-urgent"
  check_function "paddle-webhook"
  check_function "confirm-job"
  check_function "send-confirm-notification"
  check_function "provider-page"
fi

# ────────────────────────────────────────────
header "4. Service Categories Seeded"
# ────────────────────────────────────────────

if [[ -z "${SUPABASE_URL:-}" ]] || [[ -z "${ANON_KEY:-}" ]] || [[ "$SUPABASE_URL" == *"YOUR_"* ]]; then
  warn "Credentials not configured — skipping category count check"
else
  BODY=$(curl -sf --max-time 10 \
    "${SUPABASE_URL}/rest/v1/service_categories?is_active=eq.true&select=id" \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "Accept: application/json" 2>/dev/null || echo "[]")

  # Count entries in JSON array (simple approach without jq dependency)
  COUNT=$(echo "$BODY" | grep -o '"id"' | wc -l | tr -d ' ')
  if [[ "$COUNT" -ge 17 ]]; then
    ok "service_categories has $COUNT active rows (expected ≥17)"
  elif [[ "$COUNT" -gt 0 ]]; then
    warn "service_categories has $COUNT rows (expected 17 — may be incomplete)"
  else
    fail "service_categories appears empty or inaccessible"
  fi
fi

# ────────────────────────────────────────────
header "5. Provider RPCs Available"
# ────────────────────────────────────────────

if [[ -n "${SERVICE_KEY:-}" ]] && [[ "${SERVICE_KEY}" != *"YOUR_"* ]] && [[ -n "${SUPABASE_URL:-}" ]]; then
  # Use Management API SQL query to verify RPCs — more reliable than REST endpoint
  # (REST returns PGRST202/404 when called with wrong param types, even if function exists)
  PROJ_REF=$(echo "$SUPABASE_URL" | sed 's|https://||' | cut -d'.' -f1)
  RPC_RESULT=$(curl -s --max-time 15 -X POST \
    "https://api.supabase.com/v1/projects/${PROJ_REF}/database/query" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN:-}" \
    -H "Content-Type: application/json" \
    -d '{"query":"SELECT proname FROM pg_proc WHERE proname IN ('"'"'submit_bid_with_credits'"'"','"'"'activate_provider_subscription'"'"','"'"'award_win_renewal_discount'"'"','"'"'track_bid_rejection'"'"') ORDER BY proname;"}' \
    2>/dev/null || echo "[]")

  for rpc in submit_bid_with_credits activate_provider_subscription award_win_renewal_discount track_bid_rejection; do
    if echo "$RPC_RESULT" | grep -q "\"$rpc\""; then
      ok "RPC '${rpc}' exists in pg_proc"
    else
      fail "RPC '${rpc}' NOT FOUND — migration 019 may have failed"
    fi
  done
else
  warn "SUPABASE_SERVICE_ROLE_KEY not configured — skipping RPC availability checks"
  info "  Set in admin/.env.local to enable RPC health checks"
fi

# ────────────────────────────────────────────
header "6. Admin Panel"
# ────────────────────────────────────────────

# Try localhost:3000 (default Next.js port)
HTTP=$(curl -sf --max-time 5 -o /dev/null -w "%{http_code}" "http://localhost:3000" 2>/dev/null || echo "000")
if [[ "$HTTP" == "200" ]] || [[ "$HTTP" == "302" ]]; then
  ok "Admin panel running on localhost:3000 (HTTP $HTTP)"
elif [[ "$HTTP" == "000" ]]; then
  warn "Admin panel not running on localhost:3000 — start with: cd admin && npm run start"
else
  warn "Admin panel returned HTTP $HTTP on localhost:3000"
fi

# ────────────────────────────────────────────
header "7. Cron Jobs (requires supabase CLI)"
# ────────────────────────────────────────────

if command -v supabase &>/dev/null && [[ -n "${SUPABASE_PROJECT_REF:-}" ]]; then
  CRON_CHECK=$(supabase db execute \
    --project-ref "${SUPABASE_PROJECT_REF}" \
    --command "SELECT COUNT(*) AS cnt FROM cron.job WHERE active = true;" \
    2>/dev/null || echo "error")
  if echo "$CRON_CHECK" | grep -qE "[0-9]+"; then
    CNT=$(echo "$CRON_CHECK" | grep -oE "[0-9]+" | tail -1)
    if [[ "$CNT" -ge 2 ]]; then
      ok "pg_cron: $CNT active job(s) registered"
    elif [[ "$CNT" -gt 0 ]]; then
      warn "pg_cron: only $CNT active job(s) — expected ≥2 (sweep_commitments, expire_urgent)"
    else
      warn "pg_cron: no active jobs found — run migration 018+"
    fi
  else
    warn "Could not query cron.job — pg_cron may not be enabled or no SUPABASE_PROJECT_REF"
  fi
else
  warn "supabase CLI or SUPABASE_PROJECT_REF not available — skipping cron check"
  info "  Set SUPABASE_PROJECT_REF env var to enable cron health check"
fi

# ────────────────────────────────────────────
# SUMMARY
# ────────────────────────────────────────────
echo ""
echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}Health Check Results:${NC}  ✓ $PASSED passed  ✗ $FAILURES failed  ⚠ $WARNINGS warnings"
echo -e "${BOLD}══════════════════════════════════════════════════${NC}"

if [[ $FAILURES -gt 0 ]]; then
  echo -e "${RED}${BOLD}STATUS: UNHEALTHY — $FAILURES critical check(s) failed${NC}"
  echo -e "${RED}Review failures above before QA testing.${NC}"
  exit 1
elif [[ $WARNINGS -gt 0 ]]; then
  echo -e "${YELLOW}${BOLD}STATUS: DEGRADED — $WARNINGS warning(s) require attention${NC}"
  echo -e "${YELLOW}Non-critical items need review, but core services are up.${NC}"
  exit 0
else
  echo -e "${GREEN}${BOLD}STATUS: HEALTHY — All $PASSED checks passed${NC}"
  exit 0
fi
