-- ============================================================
-- Migration 017: pg_cron Job Registration
-- ============================================================
-- PREREQUISITE: Enable pg_cron in Supabase Dashboard first:
--   Dashboard → Database → Extensions → search "pg_cron" → Enable
--
-- After enabling, run this migration or paste these statements
-- in the SQL Editor. Running it again is safe (uses ON CONFLICT).
-- ============================================================

-- ── Sweep: expired provider commitment windows ────────────────
-- Runs every minute. Cancels jobs where the provider did not
-- confirm within their commitment window (5 min urgent / 15 min normal).
-- Function defined in migration 015_job_confirm_flow.sql

DO $$
BEGIN
  PERFORM cron.unschedule('sweep-job-commitments');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'sweep-job-commitments',
  '* * * * *',
  'SELECT sweep_expired_job_commitments()'
);

-- ── Sweep: expired urgent requests ───────────────────────────
-- Runs every minute. Auto-cancels urgent requests whose
-- urgent_expires_at has passed with no accepted bid.
-- Function defined in migration 010_urgent_expiry.sql

DO $$
BEGIN
  PERFORM cron.unschedule('expire-urgent-requests');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'expire-urgent-requests',
  '* * * * *',
  'SELECT expire_urgent_requests()'
);

-- ── Verify registered jobs ────────────────────────────────────
-- Run this query to confirm all cron jobs are active:
--
--   SELECT jobid, jobname, schedule, command, active
--   FROM cron.job
--   ORDER BY jobname;
--
-- NOTE: Two additional cron jobs are registered in migration 018:
--   'refresh-user-segments'   — 03:00 UTC daily
-- The notification dispatcher cron is registered via Supabase CLI:
--   supabase functions deploy notification-dispatcher --schedule "0 6 * * *"
-- Full cron registry (all 4 jobs):
--   NAME                      SCHEDULE      PURPOSE
--   sweep-job-commitments     * * * * *     Cancel expired provider commitment windows
--   expire-urgent-requests    * * * * *     Cancel timed-out urgent requests
--   refresh-user-segments     0 3 * * *     Materialise user_segments_cache (see 018)
--   notification-dispatcher   0 6 * * *     Fan-out daily push notifications
