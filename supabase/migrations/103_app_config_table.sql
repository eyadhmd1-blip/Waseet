-- ============================================================
-- Migration 103: App config table (replaces ALTER DATABASE SET)
--
-- Supabase hosted does not allow ALTER DATABASE/ROLE SET for
-- custom GUC parameters. This migration stores the two runtime
-- secrets (supabase_url, service_role_key) in a protected table
-- and rewrites all cron/trigger functions to read from it.
--
-- After applying, run this ONCE in SQL Editor:
--   INSERT INTO _waseet_config VALUES
--     ('app.settings.supabase_url',    'https://kyupkrhqitojeluczvvv.supabase.co'),
--     ('app.settings.service_role_key','<your-sb_secret_...key>');
-- ============================================================

-- ── 1. Config table (no RLS — only accessible via SECURITY DEFINER) ──

CREATE TABLE IF NOT EXISTS _waseet_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

REVOKE ALL ON _waseet_config FROM PUBLIC, anon, authenticated;

-- ── 2. Getter function (SECURITY DEFINER — runs as postgres) ─────────

CREATE OR REPLACE FUNCTION _get_waseet_config(p_key TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM _waseet_config WHERE key = p_key;
$$;

REVOKE ALL ON FUNCTION _get_waseet_config(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION _get_waseet_config(TEXT) TO service_role;

-- ── 3. Rewrite cron functions to use config table ────────────────────

-- invoke_notify_no_bids
CREATE OR REPLACE FUNCTION invoke_notify_no_bids()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_url text := _get_waseet_config('app.settings.supabase_url');
  v_key text := _get_waseet_config('app.settings.service_role_key');
BEGIN
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'notify-no-bids: config not set in _waseet_config — skipping';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := v_url || '/functions/v1/notify-no-bids',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    := '{}'::jsonb
  );
END;
$$;

-- invoke_send_delayed_commit_notifications
CREATE OR REPLACE FUNCTION invoke_send_delayed_commit_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_url text := _get_waseet_config('app.settings.supabase_url');
  v_key text := _get_waseet_config('app.settings.service_role_key');
BEGIN
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'send-delayed-commit-notifications: config not set — skipping';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := v_url || '/functions/v1/send-delayed-commit-notifications',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    := '{}'::jsonb
  );
END;
$$;

-- _invoke_notify_lifecycle
CREATE OR REPLACE FUNCTION _invoke_notify_lifecycle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url text := _get_waseet_config('app.settings.supabase_url');
  v_key text := _get_waseet_config('app.settings.service_role_key');
BEGIN
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'notify-lifecycle: config not set — skipping';
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

-- invoke_notify_admin
CREATE OR REPLACE FUNCTION invoke_notify_admin(
  p_event   TEXT,
  p_payload JSONB DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := _get_waseet_config('app.settings.supabase_url');
  v_key text := _get_waseet_config('app.settings.service_role_key');
BEGIN
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'notify-admin: config not set — skipping (event: %)', p_event;
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := v_url || '/functions/v1/notify-admin',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    := jsonb_build_object('event', p_event, 'data', p_payload)
  );
END;
$$;
