-- ============================================================
-- Migration 045 — Launch Readiness: Indexes + Hardening
-- Prepares the database for 100k-user production load.
-- Targets hot paths introduced since migration 031.
-- ============================================================

-- ── 1. notifications — per-user unread feed ──────────────────
-- The notification bell fetches all unread notifications for a
-- user ordered by time. Without this index every user query
-- is a full table scan once notifications exceed 1M rows.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE is_read = false;

-- ── 2. notifications — full history (mark-all-read + count) ─
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

-- ── 3. users — suspension status ────────────────────────────
-- Added in migration 044. The auth gate (verify.tsx) and admin
-- pages query "WHERE is_suspended = true". Partial index keeps
-- it tiny — only stores the suspended minority.
CREATE INDEX IF NOT EXISTS idx_users_suspended
  ON users (id)
  WHERE is_suspended = true;

-- ── 4. reports — admin aggregate queries ────────────────────
-- user_report_counts VIEW groups by reported_user_id + context.
-- Composite covers both the GROUP BY and any context filter.
CREATE INDEX IF NOT EXISTS idx_reports_context_user
  ON reports (reported_user_id, context, created_at DESC);

-- ── 5. requests — client history tab ────────────────────────
-- Clients list their own requests filtered by status.
-- Already have idx_requests_feed for open/city/category.
-- This covers "my requests" list (all statuses).
CREATE INDEX IF NOT EXISTS idx_requests_client_status
  ON requests (client_id, status, created_at DESC);

-- ── 6. contract_visits — contract detail screen ─────────────
-- Fetches visits for a contract ordered by scheduled_date.
CREATE INDEX IF NOT EXISTS idx_contract_visits_contract_date
  ON contract_visits (contract_id, scheduled_date);

-- ── 7. bids — provider bid history ──────────────────────────
-- Providers list their own bids (bid history tab).
-- Composite on provider_id + created_at avoids sort-after-scan.
CREATE INDEX IF NOT EXISTS idx_bids_provider_created
  ON bids (provider_id, created_at DESC);

-- ── 8. push_tokens — token lookup per user ──────────────────
-- Notification dispatch joins push_tokens on user_id.
-- Single-column index is sufficient; upsert uses user_id PK conflict.
CREATE INDEX IF NOT EXISTS idx_push_tokens_user
  ON push_tokens (user_id);

-- ── 9. jobs — active jobs per provider (feed banner) ────────
-- Provider home screen shows count of active jobs.
-- Partial index only covers the hot statuses.
CREATE INDEX IF NOT EXISTS idx_jobs_provider_active
  ON jobs (provider_id, created_at DESC)
  WHERE status IN ('in_progress', 'pending_confirmation');

-- ── 10. messages — unread count badge ───────────────────────
-- Chat tab unread count = messages WHERE job_id IN (...) AND
-- sender_id != me AND is_read = false.
-- Partial index on is_read = false stays small over time.
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON messages (job_id, sender_id)
  WHERE is_read = false;

-- ── 11. requests — urgent open requests for routing ─────────
-- get_available_providers_for_urgent filters on urgency_level
-- AND status = 'open'. Covers the routing RPC fast-path.
CREATE INDEX IF NOT EXISTS idx_requests_urgent_open
  ON requests (city, category_slug, created_at DESC)
  WHERE status = 'open' AND urgency_level = 'urgent';

-- ── 12. provider_analytics — daily aggregation ──────────────
-- Analytics cron job scans by date range per provider.
CREATE INDEX IF NOT EXISTS idx_provider_analytics_date
  ON provider_analytics (provider_id, date DESC);

-- ── 13. Tune autovacuum on high-write tables ─────────────────
-- bids and messages are written on every user action.
-- Lowering the cost delay and raising workers ensures dead
-- tuples are cleaned up promptly at high write volume.

ALTER TABLE bids SET (
  autovacuum_vacuum_scale_factor     = 0.05,
  autovacuum_analyze_scale_factor    = 0.02,
  autovacuum_vacuum_cost_delay       = 2
);

ALTER TABLE messages SET (
  autovacuum_vacuum_scale_factor     = 0.05,
  autovacuum_analyze_scale_factor    = 0.02,
  autovacuum_vacuum_cost_delay       = 2
);

ALTER TABLE notifications SET (
  autovacuum_vacuum_scale_factor     = 0.05,
  autovacuum_analyze_scale_factor    = 0.02,
  autovacuum_vacuum_cost_delay       = 2
);

-- ── Verification ─────────────────────────────────────────────
-- SELECT indexname, tablename FROM pg_indexes
-- WHERE indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;
