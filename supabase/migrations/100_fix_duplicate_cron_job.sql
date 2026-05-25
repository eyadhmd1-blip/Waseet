-- ============================================================
-- Migration 100 — Remove duplicate sweep-job-commitments cron
--
-- Migration 017 registered 'sweep-job-commitments' calling
-- sweep_expired_job_commitments() every minute.
-- Migration 087 registered 'sweep-commitment-expiry' calling
-- the same function every minute without removing the original.
-- Result: two cron jobs fire the same function simultaneously
-- every minute, causing redundant DB writes and lock contention.
--
-- Fix: unschedule the original name from 017.
-- 'sweep-commitment-expiry' (087) remains as the canonical job.
-- ============================================================

DO $$
BEGIN
  PERFORM cron.unschedule('sweep-job-commitments');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
