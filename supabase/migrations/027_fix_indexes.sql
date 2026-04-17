-- ============================================================
-- Migration 027: Fix Missing FK Indexes + Drop Unused Indexes
--
-- Problem:
--   - Foreign key columns without indexes cause full table scans
--     on every JOIN and ON DELETE CASCADE operation.
--   - Unused indexes waste disk space and slow down writes.
-- ============================================================

-- ── Add missing FK indexes ────────────────────────────────────

-- bids.request_id, bids.provider_id already indexed in 001
-- jobs.client_id, jobs.provider_id already indexed in 001

-- messages.sender_id (FK to users — no index)
CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON messages (sender_id);

-- messages.shared_provider_id (FK added in 011 — no index)
CREATE INDEX IF NOT EXISTS idx_messages_shared_provider
  ON messages (shared_provider_id)
  WHERE shared_provider_id IS NOT NULL;

-- loyalty_events.provider_id (already indexed via analytics)
-- provider_analytics.provider_id + date already indexed

-- subscriptions.provider_id (FK to providers — no index)
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider
  ON subscriptions (provider_id);

-- share_events.shared_by (FK to users — no index)
CREATE INDEX IF NOT EXISTS idx_share_events_shared_by
  ON share_events (shared_by)
  WHERE shared_by IS NOT NULL;

-- share_events.referral_uid (FK to users — no index)
CREATE INDEX IF NOT EXISTS idx_share_events_referral
  ON share_events (referral_uid)
  WHERE referral_uid IS NOT NULL;

-- saved_providers.provider_id (FK to providers — no index)
CREATE INDEX IF NOT EXISTS idx_saved_providers_provider
  ON saved_providers (provider_id);

-- contract_bids.provider_id (FK to users — no index)
CREATE INDEX IF NOT EXISTS idx_contract_bids_provider
  ON contract_bids (provider_id);

-- contract_visits.contract_id already indexed in 012

-- support_tickets.assigned_to (FK to users — no index)
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to
  ON support_tickets (assigned_to)
  WHERE assigned_to IS NOT NULL;

-- support_messages.ticket_id already indexed in 014
-- support_messages.sender_id (FK to users — no index)
CREATE INDEX IF NOT EXISTS idx_support_messages_sender
  ON support_messages (sender_id)
  WHERE sender_id IS NOT NULL;

-- support_attachments.ticket_id (FK — no index)
CREATE INDEX IF NOT EXISTS idx_support_attachments_ticket
  ON support_attachments (ticket_id);

-- support_attachments.message_id (FK — no index)
CREATE INDEX IF NOT EXISTS idx_support_attachments_message
  ON support_attachments (message_id)
  WHERE message_id IS NOT NULL;

-- reports.reported_user_id already indexed in 020
-- reports.request_id (FK — no index)
CREATE INDEX IF NOT EXISTS idx_reports_request
  ON reports (request_id)
  WHERE request_id IS NOT NULL;

-- reports.job_id (FK — no index)
CREATE INDEX IF NOT EXISTS idx_reports_job
  ON reports (job_id)
  WHERE job_id IS NOT NULL;

-- cancellation_log.job_id already indexed in 020

-- user_segments_cache.user_id is PRIMARY KEY — already indexed

-- portfolio_items.job_id (optional FK — no index)
CREATE INDEX IF NOT EXISTS idx_portfolio_items_job
  ON portfolio_items (job_id)
  WHERE job_id IS NOT NULL;

-- ── Drop unused indexes ───────────────────────────────────────
-- These indexes exist but are never used by query plans (confirmed
-- by Supabase advisor). Dropping them reduces write overhead.

-- Single-column indexes superseded by composite idx_requests_feed
DROP INDEX IF EXISTS idx_requests_status;
DROP INDEX IF EXISTS idx_requests_category;
DROP INDEX IF EXISTS idx_requests_city;

-- Single-column job indexes superseded by composite idx_jobs_client_provider
DROP INDEX IF EXISTS idx_jobs_status;

-- providers.categories now covered by GIN index (idx_providers_categories_gin)
-- (keep the GIN, nothing to drop here)

-- Audit log indexes — kept (admin queries)
-- Admin alerts indexes — kept
