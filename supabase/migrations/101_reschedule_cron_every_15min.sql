-- ============================================================
-- Migration 101 — Reschedule sweep + notifications cron jobs
--                 from every minute to every 15 minutes
--
-- Both jobs are maintenance sweeps with no hard real-time SLA.
-- Running every minute was 93% overhead with no UX benefit.
-- 15-minute interval is imperceptible to end users.
-- ============================================================

-- sweep-commitment-expiry (was: * * * * *)
SELECT cron.schedule(
  'sweep-commitment-expiry',
  '*/15 * * * *',
  'SELECT sweep_expired_job_commitments()'
);

-- delayed-commit-notifications (was: * * * * *)
SELECT cron.schedule(
  'delayed-commit-notifications',
  '*/15 * * * *',
  'SELECT invoke_send_delayed_commit_notifications()'
);
