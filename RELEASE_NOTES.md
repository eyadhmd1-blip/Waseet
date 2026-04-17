# Waseet — Release Notes

---

## v1.0.0-staging · 2026-04-15

**Release type:** First staging release — full feature baseline  
**Build target:** Staging environment (Supabase staging project + EAS staging profile)  
**Migration range:** 001 → 019 (complete)  
**Status:** ✅ Ready for functional, integration, and regression testing

---

### What's in this release

#### Core Platform
- **User authentication** via Supabase Auth (OTP phone login, JWT session management)
- **Role-based access** — client, provider, admin with RLS enforcement
- **Bilingual UI** — Arabic (default, RTL) + English (LTR) with full i18next translation coverage
- **Real-time messaging** — chat with text, image, video, audio, location, profile-card messages
- **Push notifications** — Expo push integration for bids, job updates, urgent alerts

#### Client Features
- Service request creation (normal + urgent + recurring contract)
- Bid review and acceptance flow
- Job confirmation code flow (one-time code to provider)
- Provider discovery with reputation, score, and portfolio display
- Public provider profile sharing (deep link + social share)
- Support ticket system (create, thread, rating, bilingual FAQ)

#### Provider Features
- Provider feed with live requests + urgency countdown
- **Bid credits subscription system** (migration 019 — see below)
- Bid modal with credit deduction preview and anti-spam feedback
- Recurring contract bidding
- Portfolio management (single, before/after, video)
- Notification preferences (per-category, quiet hours, frequency)
- Availability and urgent-request toggles
- Public profile page via Edge Function

#### Subscription System (v1.0 — bid credits model)
| Tier    | Price   | Credits/month | Notes                        |
|---------|---------|---------------|------------------------------|
| Trial   | Free    | 10            | Once per provider lifetime   |
| Basic   | 5 JOD   | 20            |                              |
| Pro     | 12 JOD  | 50            | Most popular                 |
| Premium | 22 JOD  | Unlimited     | Max 5 concurrent active bids |

- Credit costs: normal bid = 1, urgent bid = 2, recurring contract = 3
- Renewal discounts (stacked, hard-capped at 40%):
  - Win reward: +3% per completed job (max 15%, stored in `win_discount_pct`)
  - Reputation tier: new=0%, rising=2%, trusted=5%, expert=8%, elite=12%
  - Loyalty milestones: 10 jobs = 20%, 25 jobs = 30% (existing system retained)
- Anti-spam rules:
  - 24-hour cooldown per client after bid rejection
  - Premium plan capped at 5 concurrent pending bids
  - `bid_rejection_rate` computed over 30-day window; affects bid visibility ranking

#### Admin Panel
- Dashboard with live provider, request, bid, and job stats
- Provider, user, request, contract management
- Support ticket administration
- Notification campaign management
- Audit log viewer
- HMAC-SHA256 session authentication

#### Infrastructure
- 19 database migrations (001–019) — fully incremental
- 10 Supabase Edge Functions deployed
- 4 scheduled cron jobs (pg_cron + Supabase function scheduler)
- Materialized view: `user_segments_cache` (refreshed 03:00 UTC daily)
- Scale indexes on bids, requests, jobs, messages (migration 016)
- Connection pooling support via PgBouncer (Supabase managed)

---

### Changed vs. previous state

| Area | Change |
|------|--------|
| Subscription model | Replaced `max_services` gating (USD) with bid credits (JOD) |
| Subscription tiers | Added `trial` tier; renamed premium to `elite` in UI |
| Pricing currency | USD → JOD throughout (subscribe screen, paddle webhook) |
| Bid submission | Direct `bids` INSERT replaced with `submit_bid_with_credits` RPC |
| Provider type | Added `bid_credits`, `trial_used`, `bid_rejection_rate`, `win_discount_pct` fields |
| i18n | Complete coverage of all screens: support, portfolio, notifications, recurring contracts |
| Subscribe screen | Credits badge, trial badge, discount breakdown banner, trial activation via RPC |
| Provider feed | Credits badge in header, credit-cost hint in bid modal, RPC error codes handled |
| Provider profile | Remaining credits, win discount, reputation discount displayed on subscription card |
| Paddle webhook | Now calls `activate_provider_subscription` RPC; stacks all discount types |

---

### Database migrations in this release

| # | File | Description |
|---|------|-------------|
| 019 | `019_bid_credits.sql` | Bid credit system: new columns, 4 RPCs/functions/triggers, indexes |

All previous migrations (001–018) must be applied first.

---

### Known issues and limitations for staging

| ID | Area | Description | Workaround |
|----|------|-------------|------------|
| STG-001 | Paddle | Price IDs are placeholders (`pri_FILL_*`) — payment flow will show "setup" alert | Use Paddle Sandbox and fill real price IDs for payment testing |
| STG-002 | Expo push | Requires valid `EXPO_PUBLIC_PROJECT_ID` from expo.dev | Create Expo project and fill env var before testing push notifications |
| STG-003 | Anthropic | `ai-price-suggest` edge function requires real `ANTHROPIC_API_KEY` | Fill in staging secrets; price suggestions will be absent without it |
| STG-004 | Contract bid credits | Contract bid deducts credits via `submit_bid_with_credits` before calling `submit_contract_bid` — double-check if `submit_contract_bid` RPC itself also does any credit validation | Verify RPC chain in staging tests |
| STG-005 | Email templates | Auth email templates are Supabase defaults (not Arabic-branded) | Configure in Supabase Dashboard → Auth → Email Templates |
| STG-006 | app.json | `slug` is `"mobile"` and `bundleIdentifier`/`package` not set — EAS staging build requires these | Set in `eas.json` build profile or `app.json` before running `eas build` |

---

### QA test matrix (full regression)

See `STAGING.md` → Test Scenarios for the full test plan.

**Priority 1 — Critical path:**
- [ ] Provider trial subscription activation
- [ ] Bid submission credit deduction (normal / urgent / contract)
- [ ] Anti-spam cooldown enforcement (24h per client)
- [ ] Premium 5-bid cap enforcement
- [ ] Win discount accumulation and renewal application

**Priority 2 — Core flows:**
- [ ] Client request creation → provider bid → acceptance → job → confirmation
- [ ] Urgent request flow end-to-end
- [ ] Recurring contract creation → bidding → activation → visit scheduling
- [ ] Admin login and dashboard

**Priority 3 — Supporting:**
- [ ] Portfolio upload (photo, before/after, video)
- [ ] Support ticket creation, threading, rating
- [ ] Notification preferences
- [ ] Language switch (AR ↔ EN), RTL layout
- [ ] Push notification delivery

---

### Deployment artifacts

| Artifact | Location | Notes |
|----------|----------|-------|
| Staging guide | `STAGING.md` | Master deployment reference |
| Environment templates | `mobile/.env.staging.example`, `admin/.env.staging.example` | Fill and rename to `.env.local` |
| Deployment script | `scripts/deploy-staging.sh` | Full automated deployment |
| Health check | `scripts/health-check.sh` | Post-deploy service verification |
| Env validator | `scripts/verify-env.sh` | Pre-flight environment check |
| Test fixtures | `supabase/seed-staging.sql` | Deterministic QA test data |
| CI/CD pipeline | `.github/workflows/staging-deploy.yml` | GitHub Actions workflow |
| EAS config | `mobile/eas.json` | Expo build profiles |

---

### Sign-off

| Role | Name | Status |
|------|------|--------|
| Release Manager | — | ✅ Approved for staging |
| Technical Lead | — | ✅ Code reviewed |
| QA Lead | — | ⏳ Pending staging validation |
| Product Owner | — | ⏳ Pending UAT sign-off |
