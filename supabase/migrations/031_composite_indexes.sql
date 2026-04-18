-- ============================================================
-- Migration 031 — Composite indexes for 100k-user scale
-- Supplements the indexes from 001 and 016.
-- ============================================================

-- bids: queries always filter by request_id AND status
-- (e.g. "show pending bids for request", "count accepted bids")
CREATE INDEX IF NOT EXISTS idx_bids_request_status
  ON bids (request_id, status);

-- messages: queries always filter by job_id ORDER BY created_at
-- (chat thread — needs composite to avoid sort-after-scan)
CREATE INDEX IF NOT EXISTS idx_messages_job_created
  ON messages (job_id, created_at);

-- jobs: provider dashboard — filter by provider_id and status
CREATE INDEX IF NOT EXISTS idx_jobs_provider_status
  ON jobs (provider_id, status);

-- jobs: client requests list — filter by client_id and status
CREATE INDEX IF NOT EXISTS idx_jobs_client_status
  ON jobs (client_id, status);
