#!/usr/bin/env bash
# ============================================================
# Waseet — Pre-flight Environment Variable Validator
# Usage: bash scripts/verify-env.sh
# Run before any deployment to catch missing secrets early.
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; WARNINGS=$((WARNINGS+1)); }
error()   { echo -e "${RED}[ERROR]${NC} $*"; ERRORS=$((ERRORS+1)); }
header()  { echo -e "\n${BOLD}${CYAN}── $* ──────────────────────────${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Waseet Staging — Environment Validator  ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""

# ────────────────────────────────────────────
# MOBILE ENV
# ────────────────────────────────────────────
header "Mobile App (.env.local)"

MOBILE_ENV="$ROOT_DIR/mobile/.env.local"

if [[ ! -f "$MOBILE_ENV" ]]; then
  error "mobile/.env.local not found — copy from mobile/.env.staging.example"
else
  success "mobile/.env.local exists"

  check_mobile_var() {
    local var="$1"
    local val
    val=$(grep -E "^${var}=" "$MOBILE_ENV" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
    if [[ -z "$val" ]] || [[ "$val" == *"YOUR_"* ]] || [[ "$val" == *"REPLACE_"* ]] || [[ "$val" == *"CHANGE_"* ]]; then
      error "${var} is not set or still has placeholder value"
    else
      success "${var} = ${val:0:30}..."
    fi
  }

  check_mobile_var "EXPO_PUBLIC_SUPABASE_URL"
  check_mobile_var "EXPO_PUBLIC_SUPABASE_ANON_KEY"
  check_mobile_var "EXPO_PUBLIC_PROJECT_ID"

  # Validate URL format
  URL=$(grep -E "^EXPO_PUBLIC_SUPABASE_URL=" "$MOBILE_ENV" 2>/dev/null | cut -d= -f2-)
  if [[ "$URL" =~ ^https://[a-z0-9]+\.supabase\.co$ ]]; then
    success "EXPO_PUBLIC_SUPABASE_URL format valid"
  elif [[ -n "$URL" ]] && [[ "$URL" != *"YOUR_"* ]]; then
    warn "EXPO_PUBLIC_SUPABASE_URL format unexpected: $URL"
  fi
fi

# ────────────────────────────────────────────
# ADMIN ENV
# ────────────────────────────────────────────
header "Admin Panel (.env.local)"

ADMIN_ENV="$ROOT_DIR/admin/.env.local"

if [[ ! -f "$ADMIN_ENV" ]]; then
  error "admin/.env.local not found — copy from admin/.env.staging.example"
else
  success "admin/.env.local exists"

  check_admin_var() {
    local var="$1"
    local val
    val=$(grep -E "^${var}=" "$ADMIN_ENV" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
    if [[ -z "$val" ]] || [[ "$val" == *"YOUR_"* ]] || [[ "$val" == *"REPLACE_"* ]] || [[ "$val" == *"CHANGE_"* ]]; then
      error "${var} is not set or still has placeholder value"
    else
      success "${var} = ${val:0:30}..."
    fi
  }

  check_admin_var "NEXT_PUBLIC_SUPABASE_URL"
  check_admin_var "SUPABASE_SERVICE_ROLE_KEY"
  check_admin_var "ADMIN_USERNAME"
  check_admin_var "ADMIN_PASSWORD"
  check_admin_var "ADMIN_SESSION_SECRET"

  # Validate password strength
  PW=$(grep -E "^ADMIN_PASSWORD=" "$ADMIN_ENV" 2>/dev/null | cut -d= -f2-)
  if [[ "${#PW}" -lt 16 ]] && [[ -n "$PW" ]] && [[ "$PW" != *"CHANGE_"* ]]; then
    warn "ADMIN_PASSWORD is less than 16 characters — increase for security"
  fi

  # Validate session secret length (base64 32 bytes = 44 chars)
  SECRET=$(grep -E "^ADMIN_SESSION_SECRET=" "$ADMIN_ENV" 2>/dev/null | cut -d= -f2-)
  if [[ "${#SECRET}" -lt 32 ]] && [[ -n "$SECRET" ]] && [[ "$SECRET" != *"CHANGE_"* ]]; then
    warn "ADMIN_SESSION_SECRET seems short — generate with: openssl rand -base64 32"
  fi
fi

# ────────────────────────────────────────────
# TOOL VERSIONS
# ────────────────────────────────────────────
header "Required Tools"

check_tool() {
  local name="$1"
  local cmd="$2"
  local min_ver="$3"
  if command -v "$name" &>/dev/null; then
    local ver
    ver=$(eval "$cmd" 2>/dev/null || echo "unknown")
    success "$name found: $ver"
  else
    error "$name not found — required for deployment"
  fi
}

check_tool "node"     "node --version"     "20"
check_tool "npm"      "npm --version"       "10"
check_tool "supabase" "supabase --version"  "2"
check_tool "eas"      "eas --version"       "14"
check_tool "curl"     "curl --version | head -1" ""

# ────────────────────────────────────────────
# CONNECTIVITY
# ────────────────────────────────────────────
header "Network Connectivity"

check_url() {
  local name="$1"
  local url="$2"
  if curl -sf --max-time 5 "$url" > /dev/null 2>&1; then
    success "$name reachable"
  else
    warn "$name unreachable (may be network issue or placeholder URL)"
  fi
}

check_url "Supabase CDN" "https://supabase.com"
check_url "Expo API"     "https://api.expo.dev"

# Try staging Supabase URL if set
if [[ -f "$MOBILE_ENV" ]]; then
  SUPABASE_URL=$(grep -E "^EXPO_PUBLIC_SUPABASE_URL=" "$MOBILE_ENV" 2>/dev/null | cut -d= -f2-)
  if [[ -n "$SUPABASE_URL" ]] && [[ "$SUPABASE_URL" != *"YOUR_"* ]]; then
    check_url "Staging Supabase API" "${SUPABASE_URL}/rest/v1/"
  fi
fi

# ────────────────────────────────────────────
# NODE MODULES
# ────────────────────────────────────────────
header "Node Modules"

if [[ -d "$ROOT_DIR/mobile/node_modules" ]]; then
  success "mobile/node_modules present"
else
  warn "mobile/node_modules missing — run: cd mobile && npm install"
fi

if [[ -d "$ROOT_DIR/admin/node_modules" ]]; then
  success "admin/node_modules present"
else
  warn "admin/node_modules missing — run: cd admin && npm install"
fi

# ────────────────────────────────────────────
# PADDLE PLACEHOLDER CHECK
# ────────────────────────────────────────────
header "Paddle Price IDs"

SUBSCRIBE_FILE="$ROOT_DIR/mobile/app/subscribe.tsx"
if [[ -f "$SUBSCRIBE_FILE" ]]; then
  if grep -q "pri_FILL" "$SUBSCRIBE_FILE"; then
    warn "Paddle price IDs still placeholder in subscribe.tsx — fill before testing payments"
  else
    success "Paddle price IDs appear filled in subscribe.tsx"
  fi
fi

WEBHOOK_FILE="$ROOT_DIR/supabase/functions/paddle-webhook/index.ts"
if [[ -f "$WEBHOOK_FILE" ]]; then
  # Check if PRICE_TO_TIER has any uncommented entries
  if grep -qE '"pri_[a-z0-9]+"' "$WEBHOOK_FILE"; then
    success "Paddle PRICE_TO_TIER mapping has entries in paddle-webhook"
  else
    warn "Paddle PRICE_TO_TIER in paddle-webhook/index.ts is empty — fill for payment testing"
  fi
fi

# ────────────────────────────────────────────
# SUMMARY
# ────────────────────────────────────────────
echo ""
echo -e "${BOLD}══════════════════════════════════════════${NC}"
if [[ $ERRORS -gt 0 ]]; then
  echo -e "${RED}${BOLD}RESULT: FAIL — $ERRORS error(s), $WARNINGS warning(s)${NC}"
  echo -e "${RED}Fix all errors before deploying to staging.${NC}"
  exit 1
elif [[ $WARNINGS -gt 0 ]]; then
  echo -e "${YELLOW}${BOLD}RESULT: PASS WITH WARNINGS — $WARNINGS warning(s)${NC}"
  echo -e "${YELLOW}Review warnings above before deploying.${NC}"
  exit 0
else
  echo -e "${GREEN}${BOLD}RESULT: PASS — Environment ready for staging deployment.${NC}"
  exit 0
fi
