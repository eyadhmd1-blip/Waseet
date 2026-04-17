#!/usr/bin/env bash
# ============================================================
# Waseet — Database Migration Runner
# Usage: bash scripts/run-migrations.sh [--dry-run]
# Applies all pending Supabase migrations in order.
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

command -v supabase &>/dev/null || error "supabase CLI not found"

echo ""
echo -e "${BOLD}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Waseet — Database Migrations (Staging)       ║${NC}"
echo -e "${BOLD}╚═══════════════════════════════════════════════╝${NC}"
$DRY_RUN && echo -e "${YELLOW}[DRY-RUN MODE]${NC}"
echo ""

# Show current migration state
info "Current migration state:"
supabase migration list --project-ref "${SUPABASE_PROJECT_REF:-}" 2>/dev/null || \
  warn "Could not fetch migration state (check SUPABASE_PROJECT_REF)"

echo ""

# Count pending migrations
MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"
TOTAL=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l | tr -d ' ')
info "Found $TOTAL migration files in supabase/migrations/"

# List all migrations
ls -1 "$MIGRATIONS_DIR"/*.sql | while read -r f; do
  info "  → $(basename "$f")"
done

echo ""

if $DRY_RUN; then
  info "[DRY-RUN] Would run: supabase db push"
  echo -e "${YELLOW}Dry-run complete. No changes made.${NC}"
  exit 0
fi

# Confirmation prompt
read -rp "$(echo -e "${YELLOW}Apply all pending migrations to staging? [y/N] ${NC}")" CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }

# Push migrations
info "Applying migrations..."
if supabase db push --project-ref "${SUPABASE_PROJECT_REF:-}"; then
  success "All migrations applied."
else
  error "Migration failed. Check Supabase logs."
fi

echo ""
info "Post-migration verification queries:"
echo ""
cat <<'EOF'
-- Run these in Supabase SQL Editor to verify:

-- 1. Migration history
SELECT version, name, executed_at
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- 2. Cron jobs registered
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;

-- 3. Bid credits columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'providers'
  AND column_name IN ('bid_credits','trial_used','bid_rejection_rate','win_discount_pct');

-- 4. RPCs deployed
SELECT proname FROM pg_proc
WHERE proname IN (
  'submit_bid_with_credits',
  'activate_provider_subscription',
  'award_win_renewal_discount',
  'track_bid_rejection'
);

-- 5. Service categories seeded
SELECT COUNT(*) FROM service_categories WHERE is_active = true;
-- Expected: 17
EOF
