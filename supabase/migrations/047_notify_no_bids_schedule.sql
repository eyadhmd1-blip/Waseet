-- ============================================================
-- Migration 047 — Schedule notify-no-bids edge function
--
-- Adds a pg_cron job that calls the notify-no-bids Supabase edge
-- function every 30 minutes via pg_net.  The function sends push
-- notifications to clients whose open requests still have no bids
-- after 6 hours.
--
-- Prerequisites (run once by ops after deploy):
--   ALTER DATABASE postgres
--     SET app.settings.supabase_url    = 'https://<project-ref>.supabase.co';
--   ALTER DATABASE postgres
--     SET app.settings.service_role_key = '<service-role-key>';
-- ============================================================

-- ── Helper function: HTTP-invoke the edge function ────────────
-- Reads project URL + service role key from database settings so
-- that secrets are never stored in the migration source.

CREATE OR REPLACE FUNCTION invoke_notify_no_bids()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url text := current_setting('app.settings.supabase_url',    true);
  v_key text := current_setting('app.settings.service_role_key', true);
BEGIN
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'notify-no-bids: app.settings.supabase_url or service_role_key not configured — skipping';
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

-- ── pg_cron schedule: every 30 minutes ───────────────────────

DO $$
BEGIN
  PERFORM cron.unschedule('notify-no-bids-edge');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'notify-no-bids-edge',
  '*/30 * * * *',
  'SELECT invoke_notify_no_bids()'
);

-- ── Verification ─────────────────────────────────────────────
-- SELECT jobname, schedule, active FROM cron.job
-- WHERE jobname = 'notify-no-bids-edge';
