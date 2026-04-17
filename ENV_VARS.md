# Waseet — Environment Variables Reference

All variables required across every environment layer before going live.

---

## 1. Mobile App — `mobile/.env.local`

| Variable | Where to get it | Notes |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL | e.g. `https://abcdefgh.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → `anon` `public` key | Safe to expose in the bundle |
| `EXPO_PUBLIC_PROJECT_ID` | Expo Dashboard → your project → Project ID | Required for push notifications via Expo. Create project at expo.dev if not done yet |

---

## 2. Admin Panel — `admin/.env.local`

| Variable | Where to get it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as mobile | Used for client-side Supabase calls |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → `service_role` key | **Never expose. Server-side only.** |
| `ADMIN_USERNAME` | Your choice | Login username for the admin panel |
| `ADMIN_PASSWORD` | Your choice | Login password — use a strong password (≥16 chars) |
| `ADMIN_SESSION_SECRET` | Generate with: `openssl rand -base64 32` | Signs HMAC-SHA256 session tokens. **Must be kept secret and rotated if compromised.** |

---

## 3. Supabase Edge Functions — Secrets

Set these in: **Supabase Dashboard → Edge Functions → Secrets**

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase into every edge function — **do not set them manually**.

| Variable | Used by | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | `ai-price-suggest`, `notification-engine` | console.anthropic.com → API Keys |
| `PADDLE_WEBHOOK_SECRET` | `paddle-webhook` | Paddle Dashboard → Notifications → your notification → Secret key |

---

## 4. Paddle — Price IDs (hardcoded in source)

These are **not environment variables** — they are constants in the code. Fill them in after creating products in Paddle.

### `mobile/app/subscribe.tsx` — line 23
```typescript
const PADDLE_PRICE_IDS: Record<string, string> = {
  basic:   'pri_FILL_BASIC',    // ← replace with real Paddle price ID
  pro:     'pri_FILL_PRO',
  premium: 'pri_FILL_PREMIUM',
};
```

### `supabase/functions/paddle-webhook/index.ts` — line 26
```typescript
const PRICE_TO_TIER: Record<string, "basic" | "pro" | "premium"> = {
  // "pri_xxxxxxxx": "basic",   // ← uncomment and fill
  // "pri_yyyyyyyy": "pro",
  // "pri_zzzzzzzz": "premium",
};
```

Steps to get Paddle price IDs:
1. Create a Paddle Sandbox account at sandbox-vendors.paddle.com
2. Create 3 products: Waseet Basic ($9/mo), Pro ($19/mo), Premium ($39/mo)
3. For each product create a price → copy the `pri_xxxxx` ID
4. Fill in both files above and commit

---

## 5. pg_cron — One-time Activation + All Cron Jobs

**Step 1:** Enable pg_cron:
1. Supabase Dashboard → Database → Extensions → search "pg_cron" → Enable

**Step 2:** Run DB-level cron registrations in SQL Editor (order matters):
```
migration 017_cron_activation.sql   — sweep jobs (every minute)
migration 018_user_segments_cache.sql — segment refresh (03:00 UTC daily)
```

**Step 3:** Deploy the notification dispatcher with its schedule via CLI:
```bash
supabase functions deploy notification-dispatcher --schedule "0 6 * * *"
```

Full cron registry after setup:

| Job name | Schedule | Purpose |
|---|---|---|
| `sweep-job-commitments` | `* * * * *` | Cancel expired provider commitment windows |
| `expire-urgent-requests` | `* * * * *` | Cancel timed-out urgent requests |
| `refresh-user-segments` | `0 3 * * *` | Materialise `user_segments_cache` (3AM UTC) |
| `notification-dispatcher` | `0 6 * * *` | Fan-out daily push notifications (6AM UTC) |

Verify all jobs are registered:
```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
```

---

## 6. Edge Functions — Deploy Order

```bash
supabase functions deploy ai-price-suggest
supabase functions deploy notification-engine
supabase functions deploy notification-dispatcher --schedule "0 6 * * *"
supabase functions deploy notify-provider-bid-accepted
supabase functions deploy notify-urgent
supabase functions deploy paddle-webhook
supabase functions deploy confirm-job
supabase functions deploy send-confirm-notification
supabase functions deploy notification-engine
supabase functions deploy provider-page
```

---

## 7. Supabase Auth — Email Templates (optional but recommended)

Configure in Supabase Dashboard → Authentication → Email Templates:
- **Confirm signup** — branded Arabic template
- **Magic Link** — if used
- **Reset password** — Arabic template

---

## 8. Deployment Checklist

**Environment variables:**
- [ ] `mobile/.env.local` — all 3 vars filled
- [ ] `admin/.env.local` — all 5 vars filled (`ADMIN_SESSION_SECRET` generated with `openssl rand -base64 32`)
- [ ] Edge function secrets: `ANTHROPIC_API_KEY` and `PADDLE_WEBHOOK_SECRET` set in Dashboard

**Database migrations (run in order):**
- [ ] 001 → 018 migrations applied
- [ ] pg_cron extension enabled
- [ ] migrations 017 + 018 run after enabling pg_cron
- [ ] Verify: `SELECT COUNT(*) FROM user_segments_cache;` — should be > 0

**Edge functions:**
- [ ] All functions deployed
- [ ] `notification-dispatcher` deployed with `--schedule "0 6 * * *"`
- [ ] `EXPO_PUBLIC_PROJECT_ID` filled (Expo project created at expo.dev)

**Integrations:**
- [ ] Paddle price IDs filled in `subscribe.tsx` and `paddle-webhook/index.ts`
- [ ] Paddle webhook URL registered: `https://<project>.supabase.co/functions/v1/paddle-webhook`
- [ ] Supabase Realtime enabled for tables: `jobs`, `messages`, `support_messages`

**Scale readiness (at >50k users):**
- [ ] Supabase plan: Team or higher (for Realtime connection limits)
- [ ] Connection pooling: PgBouncer enabled in Supabase Dashboard (transaction mode)
- [ ] At 200k+ concurrent active users: migrate Realtime to Ably or Pusher Channels
