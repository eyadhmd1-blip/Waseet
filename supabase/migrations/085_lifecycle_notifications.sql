-- ============================================================
-- Migration 085: Lifecycle Notification Automations
-- ============================================================
-- 5 automated lifecycle events sent once daily at 06:00 UTC
-- (09:00 Amman time):
--
--   1. bid_reminder       — new provider with 0 bids after 48h
--   2. client_onboarding  — new client with 0 requests after 24h
--   3. rating_reminder    — completed job without rating after 24h
--   4. portfolio_reminder — new provider with 0 portfolio items after 7d
--   5. reengagement       — any user inactive ≥21 days
--
-- Tracking columns prevent duplicate sends.
-- ============================================================

-- ─── 1. Tracking columns ─────────────────────────────────────

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS bid_reminder_sent_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS portfolio_reminder_sent_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS client_onboarding_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_seen_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reengagement_sent_at      TIMESTAMPTZ;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS rating_reminder_sent_at TIMESTAMPTZ;

-- ─── 2. update_last_seen() — app calls this on every launch ──
-- Keeps last_seen_at fresh so the reengagement query is accurate.

CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE users SET last_seen_at = NOW() WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION update_last_seen() TO authenticated;

-- ─── 3. Query helpers (called by notify-lifecycle Edge Function) ─
-- Each function returns the eligible rows for one lifecycle event.
-- LEFT JOIN push_tokens so callers can skip users without tokens
-- for push but still insert in-app notifications.

CREATE OR REPLACE FUNCTION _lc_bid_reminder_targets()
RETURNS TABLE(provider_id UUID, full_name TEXT, lang TEXT, token TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, u.full_name, u.lang, pt.token
  FROM providers p
  JOIN users u ON u.id = p.id
  LEFT JOIN push_tokens pt ON pt.user_id = p.id
  WHERE u.created_at BETWEEN NOW() - INTERVAL '72 hours' AND NOW() - INTERVAL '48 hours'
    AND p.bid_reminder_sent_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM bids b WHERE b.provider_id = p.id);
$$;

CREATE OR REPLACE FUNCTION _lc_client_onboarding_targets()
RETURNS TABLE(user_id UUID, full_name TEXT, lang TEXT, token TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.full_name, u.lang, pt.token
  FROM users u
  LEFT JOIN push_tokens pt ON pt.user_id = u.id
  WHERE u.role = 'client'
    AND u.created_at BETWEEN NOW() - INTERVAL '48 hours' AND NOW() - INTERVAL '24 hours'
    AND u.client_onboarding_sent_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.client_id = u.id);
$$;

CREATE OR REPLACE FUNCTION _lc_rating_reminder_targets()
RETURNS TABLE(job_id UUID, client_id UUID, lang TEXT, token TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT j.id, j.client_id, u.lang, pt.token
  FROM jobs j
  JOIN users u ON u.id = j.client_id
  LEFT JOIN push_tokens pt ON pt.user_id = j.client_id
  WHERE j.status = 'completed'
    AND j.confirmed_at BETWEEN NOW() - INTERVAL '48 hours' AND NOW() - INTERVAL '24 hours'
    AND j.client_rating IS NULL
    AND j.rating_reminder_sent_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION _lc_portfolio_reminder_targets()
RETURNS TABLE(provider_id UUID, full_name TEXT, lang TEXT, token TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, u.full_name, u.lang, pt.token
  FROM providers p
  JOIN users u ON u.id = p.id
  LEFT JOIN push_tokens pt ON pt.user_id = p.id
  WHERE u.created_at BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
    AND p.portfolio_reminder_sent_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM portfolio_items pi WHERE pi.provider_id = p.id);
$$;

CREATE OR REPLACE FUNCTION _lc_reengagement_targets()
RETURNS TABLE(user_id UUID, full_name TEXT, lang TEXT, role TEXT, token TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.full_name, u.lang, u.role::text, pt.token
  FROM users u
  LEFT JOIN push_tokens pt ON pt.user_id = u.id
  WHERE COALESCE(u.last_seen_at, u.created_at) < NOW() - INTERVAL '21 days'
    AND u.reengagement_sent_at IS NULL
    AND u.role IN ('client', 'provider');
$$;

-- ─── 4. Cron invoker ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION _invoke_notify_lifecycle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url text := current_setting('app.settings.supabase_url',     true);
  v_key text := current_setting('app.settings.service_role_key', true);
BEGIN
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'notify-lifecycle cron: settings not configured — skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/notify-lifecycle',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    := '{}'::jsonb
  );
END;
$$;

-- Daily at 06:00 UTC (09:00 Amman)
DO $$ BEGIN PERFORM cron.unschedule('notify-lifecycle-daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'notify-lifecycle-daily',
  '0 6 * * *',
  $$SELECT _invoke_notify_lifecycle()$$
);

-- ─── 5. Grants ───────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION _lc_bid_reminder_targets()       TO service_role;
GRANT EXECUTE ON FUNCTION _lc_client_onboarding_targets()  TO service_role;
GRANT EXECUTE ON FUNCTION _lc_rating_reminder_targets()    TO service_role;
GRANT EXECUTE ON FUNCTION _lc_portfolio_reminder_targets() TO service_role;
GRANT EXECUTE ON FUNCTION _lc_reengagement_targets()       TO service_role;
GRANT EXECUTE ON FUNCTION _invoke_notify_lifecycle()       TO service_role;
