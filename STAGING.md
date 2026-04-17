# Waseet — Staging Deployment Guide

**Release:** v1.0.0-staging  
**Date:** 2026-04-15  
**Target:** Supabase staging project + EAS staging build + Vercel/Node admin

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Setup](#2-environment-setup)
3. [Database: Migrations](#3-database-migrations)
4. [Edge Functions Deployment](#4-edge-functions-deployment)
5. [Admin Panel Deployment](#5-admin-panel-deployment)
6. [Mobile App Build](#6-mobile-app-build)
7. [Post-Deployment Verification](#7-post-deployment-verification)
8. [Test Scenarios](#8-test-scenarios)
9. [Rollback Procedure](#9-rollback-procedure)
10. [Contacts and Escalation](#10-contacts-and-escalation)

---

## 1. Prerequisites

### Required tools (install before starting)

```bash
# Node.js 20 LTS
node --version   # must be >= 20.0.0

# npm 10+
npm --version    # must be >= 10.0.0

# Supabase CLI
npm install -g supabase
supabase --version  # must be >= 2.0.0

# Expo CLI + EAS CLI (for mobile builds)
npm install -g expo-cli eas-cli
eas --version    # must be >= 14.0.0

# Optional: Vercel CLI (for admin deployment)
npm install -g vercel
vercel --version
```

### Required accounts

| Service | Purpose | URL |
|---------|---------|-----|
| Supabase (staging project) | Database + Auth + Edge Functions | supabase.com |
| Expo account | EAS builds + push notifications | expo.dev |
| Paddle Sandbox | Payment testing | sandbox-vendors.paddle.com |
| Anthropic | AI price suggestions | console.anthropic.com |
| Vercel / hosting | Admin panel | vercel.com (or self-host) |
| GitHub | Source control + CI/CD | github.com |

---

## 2. Environment Setup

### 2.1 Create a staging Supabase project

1. Go to **app.supabase.com → New Project**
2. Name: `waseet-staging`
3. Database password: generate a strong password (save it)
4. Region: closest to your target user base (recommended: `eu-central-1` for Jordan)
5. Wait for project initialization (~2 minutes)
6. Copy from **Settings → API**:
   - **Project URL** → `STAGING_SUPABASE_URL`
   - **anon / public key** → `STAGING_SUPABASE_ANON_KEY`
   - **service_role key** → `STAGING_SERVICE_ROLE_KEY`

### 2.2 Configure mobile environment

```bash
cd mobile

# Copy template
cp .env.staging.example .env.local

# Edit with your staging values
# EXPO_PUBLIC_SUPABASE_URL=https://YOUR_STAGING_PROJECT.supabase.co
# EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
# EXPO_PUBLIC_PROJECT_ID=YOUR_EXPO_PROJECT_ID
```

### 2.3 Configure admin environment

```bash
cd admin

# Copy template
cp .env.staging.example .env.local

# Edit with your staging values
# ADMIN_SESSION_SECRET must be generated: openssl rand -base64 32
```

### 2.4 Validate all environment variables

```bash
# From project root
bash scripts/verify-env.sh
```

---

## 3. Database: Migrations

### 3.1 Enable pg_cron extension (required before migration 017)

1. Supabase Dashboard → **Database → Extensions**
2. Search `pg_cron` → click **Enable**

### 3.2 Link Supabase CLI to staging project

```bash
# Get project reference from Supabase Dashboard → Settings → General → Reference ID
supabase link --project-ref YOUR_STAGING_PROJECT_REF
```

### 3.3 Run all migrations

```bash
# Automated (recommended)
bash scripts/run-migrations.sh

# Or manually via CLI
supabase db push
```

> **Note:** Migrations run in filename order (001 → 019). The CLI applies only unapplied migrations tracked in `supabase_migrations` table.

### 3.4 Verify migration state

```sql
-- Run in Supabase SQL Editor
SELECT version, name, executed_at
FROM supabase_migrations.schema_migrations
ORDER BY version;
-- Expected: 19 rows (001 → 019)

-- Verify cron jobs
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
-- Expected: sweep-job-commitments, expire-urgent-requests, refresh-user-segments

-- Verify service categories seeded
SELECT COUNT(*) FROM service_categories WHERE is_active = true;
-- Expected: 17

-- Verify bid credits columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'providers'
  AND column_name IN ('bid_credits','trial_used','bid_rejection_rate','win_discount_pct');
-- Expected: 4 rows

-- Verify RPC functions exist
SELECT proname FROM pg_proc
WHERE proname IN ('submit_bid_with_credits','activate_provider_subscription',
                  'award_win_renewal_discount','track_bid_rejection');
-- Expected: 4 rows
```

### 3.5 Enable Realtime for required tables

In Supabase Dashboard → **Database → Replication → Tables**, enable Realtime for:

- [ ] `jobs`
- [ ] `messages`
- [ ] `support_messages`
- [ ] `bids`
- [ ] `requests`

---

## 4. Edge Functions Deployment

### 4.1 Set edge function secrets

In Supabase Dashboard → **Edge Functions → Secrets**:

```
ANTHROPIC_API_KEY     = sk-ant-...   (from console.anthropic.com)
PADDLE_WEBHOOK_SECRET = pdl_...      (from Paddle Dashboard → Notifications)
```

> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are **auto-injected** — do not set manually.

### 4.2 Deploy all functions

```bash
# Automated (recommended)
bash scripts/deploy-functions.sh

# Or manually (in this order):
supabase functions deploy ai-price-suggest
supabase functions deploy notification-engine
supabase functions deploy notification-dispatcher --schedule "0 6 * * *"
supabase functions deploy notify-provider-bid-accepted
supabase functions deploy notify-urgent
supabase functions deploy paddle-webhook
supabase functions deploy confirm-job
supabase functions deploy send-confirm-notification
supabase functions deploy provider-page
```

### 4.3 Register Paddle webhook

1. Paddle Sandbox Dashboard → **Notifications → New notification**
2. URL: `https://YOUR_STAGING_PROJECT.supabase.co/functions/v1/paddle-webhook`
3. Events to subscribe:
   - `transaction.completed`
   - `subscription.activated`
   - `subscription.renewed`
   - `subscription.canceled`
4. Copy the **Secret key** → set as `PADDLE_WEBHOOK_SECRET` in Supabase secrets

### 4.4 Configure Paddle products (staging/sandbox)

1. Create 3 subscription products in Paddle Sandbox:
   - Waseet Basic — 5 JOD/month
   - Waseet Pro — 12 JOD/month
   - Waseet Elite — 22 JOD/month
2. For each product, create a price and copy the `pri_xxxxx` ID
3. Update `mobile/app/subscribe.tsx` line ~24:
   ```typescript
   const PADDLE_PRICE_IDS: Record<string, string> = {
     basic:   'pri_STAGING_BASIC',
     pro:     'pri_STAGING_PRO',
     premium: 'pri_STAGING_PREMIUM',
   };
   ```
4. Update `supabase/functions/paddle-webhook/index.ts` PRICE_TO_TIER map

### 4.5 Verify edge function deployment

```bash
# List deployed functions
supabase functions list

# Test ai-price-suggest (if ANTHROPIC_API_KEY is set)
curl -s -X POST \
  "https://YOUR_STAGING_PROJECT.supabase.co/functions/v1/ai-price-suggest" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"category":"electrical","city":"عمان","description":"إصلاح دائرة كهربائية"}' \
  | jq .
```

---

## 5. Admin Panel Deployment

### 5.1 Local staging run (for initial verification)

```bash
cd admin
npm install
npm run build
npm run start
# Access at: http://localhost:3000
# Login with ADMIN_USERNAME / ADMIN_PASSWORD from .env.local
```

### 5.2 Deploy to Vercel (recommended for staging)

```bash
cd admin

# Login to Vercel
vercel login

# Deploy to staging
vercel --env NEXT_PUBLIC_SUPABASE_URL="https://YOUR_STAGING.supabase.co" \
       --env SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
       --env ADMIN_USERNAME="waseet_admin_staging" \
       --env ADMIN_PASSWORD="$(openssl rand -base64 24)" \
       --env ADMIN_SESSION_SECRET="$(openssl rand -base64 32)"

# Or set env vars in Vercel dashboard and deploy:
vercel deploy
```

### 5.3 Self-hosted (Docker alternative)

```bash
cd admin
# Build
npm run build

# Start production server
PORT=3001 npm run start &

# Or use pm2
npm install -g pm2
pm2 start "npm run start" --name waseet-admin-staging
pm2 save
```

---

## 6. Mobile App Build

### 6.1 Install dependencies

```bash
cd mobile
npm install
```

### 6.2 Configure EAS project

```bash
# Login to Expo
eas login

# Initialize EAS project (only first time)
eas init

# eas.json has 3 profiles: development, staging, production
# staging profile uses internal distribution (no store submission)
```

### 6.3 Build staging APK (Android — for device testing)

```bash
cd mobile
eas build --profile staging --platform android
# This produces a .apk / .aab for internal testing
# Download link sent to Expo dashboard
```

### 6.4 Build staging iOS (requires Apple Developer account)

```bash
cd mobile
eas build --profile staging --platform ios
# Produces .ipa for TestFlight or direct install
```

### 6.5 Run on simulator / device (fastest for QA)

```bash
cd mobile
# Ensure .env.local points to staging Supabase
npx expo start --clear

# On Android: press 'a' or scan QR
# On iOS:     press 'i' or scan QR with Camera app
```

### 6.6 OTA update (after code changes, no rebuild needed)

```bash
cd mobile
eas update --branch staging --message "v1.0.0-staging hotfix"
```

---

## 7. Post-Deployment Verification

### 7.1 Run automated health check

```bash
bash scripts/health-check.sh
```

This script checks:
- Supabase API reachable
- All 10 edge functions responding
- Database tables accessible via anon key
- Cron jobs registered
- Realtime tables listed

### 7.2 Seed test data

```bash
# Apply staging seed in Supabase SQL Editor
# Copy and paste contents of: supabase/seed-staging.sql

# Or via CLI (requires supabase linked)
supabase db execute --file supabase/seed-staging.sql
```

### 7.3 Manual smoke tests

#### Auth flow
1. Open app → tap "ابدأ الآن"
2. Enter test phone number (use Twilio test number or real device)
3. Enter OTP → select role "Client"
4. Verify dashboard loads

#### Provider subscription (trial)
1. Register as provider
2. Go to subscribe screen
3. Select "تجريبية" (Trial) plan
4. Confirm activation → verify `bid_credits = 10` in Supabase Dashboard

#### Bid submission
1. Create a request as client
2. Switch to provider account
3. Open provider feed → tap "زايد" on request
4. Verify credit cost hint shows "سيُخصم 1 رصيد"
5. Submit bid → verify `bid_credits` decremented in `providers` table

#### Admin panel
1. Navigate to admin URL
2. Login with `ADMIN_USERNAME` / `ADMIN_PASSWORD`
3. Verify dashboard stats load
4. Check Providers list

---

## 8. Test Scenarios

### 8.1 Subscription and Credits (Priority 1 — MUST PASS)

| # | Scenario | Steps | Expected result |
|---|----------|-------|-----------------|
| S1 | Trial activation | New provider → subscribe → select Trial | `is_subscribed=true`, `bid_credits=10`, `trial_used=true`, `subscription_tier=trial` |
| S2 | Trial re-use blocked | Provider with `trial_used=true` → subscribe → select Trial | Alert "استُخدمت مسبقاً", no DB change |
| S3 | Basic subscription | Subscribe → Basic → Paddle checkout (sandbox) → webhook fires | `bid_credits=20`, `subscription_tier=basic` |
| S4 | Pro subscription | Subscribe → Pro → Paddle webhook | `bid_credits=50`, `subscription_tier=pro` |
| S5 | Elite subscription | Subscribe → Elite → Paddle webhook | `bid_credits=0` (unlimited), `subscription_tier=premium` |
| S6 | Normal bid deducts 1 | Provider trial, bid on normal request | `bid_credits` decremented by 1 |
| S7 | Urgent bid deducts 2 | Provider trial, bid on urgent request | `bid_credits` decremented by 2 |
| S8 | Contract bid deducts 3 | Provider trial, bid on contract | `bid_credits` decremented by 3 |
| S9 | Zero credits blocked | Provider with 0 credits, bid attempt | RPC returns `NO_CREDITS` error, alert shown |
| S10 | Premium unlimited | Elite provider, submit 4 normal bids | All accepted, `bid_credits` stays 0 |
| S11 | Premium 5-bid cap | Elite provider, 5 pending bids → 6th | RPC returns `MAX_ACTIVE_BIDS` error |

### 8.2 Anti-Spam (Priority 1)

| # | Scenario | Steps | Expected result |
|---|----------|-------|-----------------|
| AS1 | 24h cooldown on rejection | Client rejects bid → provider bids on another request from same client | RPC returns `COOLDOWN_ACTIVE`, alert shown |
| AS2 | Cooldown expires | Same as AS1, but after 24h | Bid succeeds |
| AS3 | Cooldown different client | Client A rejects → provider bids on Client B request | Bid succeeds (no cooldown across clients) |
| AS4 | Rejection rate computed | 5 bids, 4 rejected | `bid_rejection_rate ≈ 0.8` in providers table |

### 8.3 Discounts (Priority 2)

| # | Scenario | Steps | Expected result |
|---|----------|-------|-----------------|
| D1 | Win discount earned | Complete 1 job → check provider | `win_discount_pct = 3` |
| D2 | Win discount cap | Complete 5 jobs (15% total) → complete 1 more | `win_discount_pct` stays at 15 |
| D3 | Discount on renewal | Provider with `win_discount_pct=6`, `reputation=trusted (5%)` → renew Pro (12 JOD) | Price shown = 12 × (1 - 0.11) ≈ 10.68 JOD |
| D4 | Discount resets after renewal | After renewal with discount | `win_discount_pct = 0`, `loyalty_discount = 0` |
| D5 | 40% cap | All discounts sum > 40 | Capped at 40%; price = 60% of base |

### 8.4 Core Job Flow (Priority 2)

| # | Scenario | Steps | Expected result |
|---|----------|-------|-----------------|
| J1 | Full job lifecycle | Request → Bid → Accept → Commit → Confirm code → Job done | All status transitions correct; provider score updated |
| J2 | Urgent job flow | Create urgent request → accept → countdown works → confirm within 60min | Urgent premium applied; job completes |
| J3 | Contract flow | Create recurring contract → provider bids → accept → visits created | `contract_visits` seeded; visits scheduled |

### 8.5 UI / i18n (Priority 3)

| # | Scenario | Expected result |
|---|----------|-----------------|
| I1 | Arabic default | App opens in Arabic, RTL layout, right-to-left text |
| I2 | Switch to English | All labels, buttons, placeholders in English, LTR layout |
| I3 | Date formatting | Arabic dates show `ar-JO` locale; English show `en-GB` |
| I4 | Credits badge Arabic | "10 رصيد متبقٍ" in provider feed header |
| I5 | Credits badge English | "10 credits left" in provider feed header |

---

## 9. Rollback Procedure

### 9.1 Revert edge functions to previous version

```bash
# Supabase keeps deployment history
# Re-deploy previous commit's functions:
git checkout <previous-commit-sha>
bash scripts/deploy-functions.sh
```

### 9.2 Revert database migration (019 only)

Migration 019 adds columns and creates functions — it's additive and non-destructive.  
To revert, run the following in Supabase SQL Editor:

```sql
-- Remove triggers
DROP TRIGGER IF EXISTS trg_track_bid_rejection ON bids;
DROP TRIGGER IF EXISTS trg_award_win_discount ON jobs;

-- Remove functions
DROP FUNCTION IF EXISTS submit_bid_with_credits(UUID, UUID, NUMERIC, TEXT, INT);
DROP FUNCTION IF EXISTS activate_provider_subscription(UUID, TEXT, INT);
DROP FUNCTION IF EXISTS award_win_renewal_discount(UUID);
DROP FUNCTION IF EXISTS track_bid_rejection();
DROP FUNCTION IF EXISTS trg_fn_award_win_discount();

-- Remove columns from bids
ALTER TABLE bids
  DROP COLUMN IF EXISTS credit_cost,
  DROP COLUMN IF EXISTS rejected_at;

-- Remove columns from providers
ALTER TABLE providers
  DROP COLUMN IF EXISTS bid_credits,
  DROP COLUMN IF EXISTS trial_used,
  DROP COLUMN IF EXISTS bid_rejection_rate,
  DROP COLUMN IF EXISTS win_discount_pct;

-- Remove indexes
DROP INDEX IF EXISTS idx_bids_provider_rejected_at;
DROP INDEX IF EXISTS idx_bids_provider_status_pending;
DROP INDEX IF EXISTS idx_providers_bid_credits;

-- Note: cannot remove enum value 'trial' from subscription_tier
-- (Postgres does not support removing enum values)
-- Workaround: mark trial providers as 'basic' if needed
```

### 9.3 Mobile rollback

```bash
# Revert to previous OTA update
eas update:rollback --branch staging
```

### 9.4 Admin rollback

```bash
# Revert Vercel deployment
vercel rollback [deployment-url]
```

---

## 10. Contacts and Escalation

| Issue | First responder | Escalation |
|-------|----------------|------------|
| Database / migrations | Backend team | Supabase support (supabase.com/support) |
| Edge function failures | Backend team | Check Supabase → Edge Functions → Logs |
| Push notification failure | Mobile team | Expo status page (status.expo.dev) |
| Payment webhook failure | Backend team | Paddle Sandbox logs → Developer → Logs |
| Mobile build failure | Mobile team | EAS dashboard → Build logs |
| Admin panel down | Frontend team | Vercel → Deployments → Logs |

### Monitoring during staging

- **Supabase Logs**: Dashboard → Logs → API / Database / Edge Functions
- **Realtime Inspector**: Dashboard → Database → Replication
- **cron.job status**: `SELECT jobname, schedule, active FROM cron.job;`
- **Error budget**: aim for < 1% error rate on RPC calls during QA week

---

## Appendix A — Quick Reference Commands

```bash
# Run full deployment
bash scripts/deploy-staging.sh

# Verify environment
bash scripts/verify-env.sh

# Run health check
bash scripts/health-check.sh

# Seed test data
supabase db execute --file supabase/seed-staging.sql

# Check migration state
supabase migration list

# View edge function logs (live tail)
supabase functions logs ai-price-suggest --tail

# Open Supabase Studio (local)
supabase studio

# Start mobile with staging env
cd mobile && npx expo start --clear

# Start admin locally
cd admin && npm run dev

# Build staging APK
cd mobile && eas build --profile staging --platform android
```

## Appendix B — Staging Environment Summary

| Layer | Service | Notes |
|-------|---------|-------|
| Database | Supabase (Free/Pro) | waseet-staging project |
| Auth | Supabase Auth | Phone OTP via Twilio |
| Edge Functions | Supabase Functions (Deno) | 10 functions |
| Storage | Supabase Storage | portfolio images, avatars |
| Mobile | EAS Build / Expo Go | internal distribution |
| Admin | Vercel / Node.js | HMAC session auth |
| Payments | Paddle Sandbox | test cards at paddle.com/docs |
| Push | Expo Push Service | requires valid project ID |
| AI | Anthropic Claude 3.5 | `ai-price-suggest` only |
| CDN | Supabase CDN (via Storage) | auto |
