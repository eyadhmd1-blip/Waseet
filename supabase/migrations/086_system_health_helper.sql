-- ============================================================
-- Migration 086: System Health Helper
-- ============================================================
-- Exposes a read-only view of pg_cron execution history so the
-- admin System Health page can show last-run status for each
-- scheduled job without requiring direct cron schema access.
-- ============================================================

CREATE OR REPLACE FUNCTION admin_cron_status()
RETURNS TABLE(
  jobname     TEXT,
  schedule    TEXT,
  last_run    TIMESTAMPTZ,
  last_status TEXT,
  last_error  TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    j.jobname,
    j.schedule,
    d.start_time,
    d.status::text,
    d.return_message
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT start_time, status, return_message
    FROM cron.job_run_details rd
    WHERE rd.jobid = j.jobid
    ORDER BY rd.start_time DESC
    LIMIT 1
  ) d ON true
  ORDER BY j.jobname;
$$;

GRANT EXECUTE ON FUNCTION admin_cron_status() TO service_role;
