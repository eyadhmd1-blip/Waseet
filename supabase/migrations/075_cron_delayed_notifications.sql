-- ============================================================
-- 075_cron_delayed_notifications.sql
--
-- Schedules the send-delayed-commit-notifications edge function
-- to run every minute via pg_cron + pg_net.
--
-- The function flushes any jobs whose grace period has expired
-- (provider_notif_due_at <= NOW) and sends the bid-accepted push
-- notification to the winning provider.
--
-- Prerequisites (already set up by migration 060):
--   ALTER DATABASE postgres
--     SET app.settings.supabase_url     = 'https://<ref>.supabase.co';
--   ALTER DATABASE postgres
--     SET app.settings.service_role_key = '<service-role-key>';
-- ============================================================

CREATE OR REPLACE FUNCTION invoke_send_delayed_commit_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url text := current_setting('app.settings.supabase_url',     true);
  v_key text := current_setting('app.settings.service_role_key', true);
BEGIN
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'send-delayed-commit-notifications: supabase_url or service_role_key not configured — skipping';
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

-- ── pg_cron: every minute ─────────────────────────────────────

DO $$
BEGIN
  PERFORM cron.unschedule('delayed-commit-notifications');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'delayed-commit-notifications',
  '* * * * *',
  'SELECT invoke_send_delayed_commit_notifications()'
);

-- ── Verification ─────────────────────────────────────────────
-- SELECT jobname, schedule, active FROM cron.job
-- WHERE jobname = 'delayed-commit-notifications';
