-- ============================================================
-- Migration 023: Fix Critical Security Issues
--
-- Fixes:
--   1. Enable RLS on share_events (was missing entirely)
--   2. Recreate 3 views as SECURITY INVOKER (Supabase default
--      treats views without explicit security_invoker=true as
--      SECURITY DEFINER — runs as view creator, bypasses RLS)
-- ============================================================

-- ── 1. Enable RLS on share_events ────────────────────────────
-- Migration 011 created this table but never enabled RLS.

ALTER TABLE share_events ENABLE ROW LEVEL SECURITY;

-- Providers can read their own share events
CREATE POLICY "share_events_provider_read_own"
  ON share_events FOR SELECT
  USING (provider_id = (SELECT auth.uid()));

-- Any authenticated user can insert (record_profile_share RPC calls this
-- via SECURITY DEFINER, but a direct INSERT policy is required for RLS)
CREATE POLICY "share_events_insert_authenticated"
  ON share_events FOR INSERT
  WITH CHECK (shared_by = (SELECT auth.uid()) OR shared_by IS NULL);

-- ── 2. Recreate views as SECURITY INVOKER ────────────────────
-- Supabase (PostgreSQL 15+) supports `security_invoker = true`.
-- Without this, the view runs as its creator (superuser), bypassing
-- the calling user's RLS policies — equivalent to SECURITY DEFINER.

-- 2a. user_segments
CREATE OR REPLACE VIEW user_segments
  WITH (security_invoker = true)
AS
SELECT
  u.id            AS user_id,
  u.role,
  u.city,
  u.created_at,
  COUNT(r.id)     AS total_requests,
  MAX(r.created_at) AS last_request_at,
  CASE
    WHEN COUNT(r.id) = 0 AND u.created_at > NOW() - INTERVAL '14 days'
      THEN 'new'
    WHEN COUNT(r.id) = 0 AND u.created_at < NOW() - INTERVAL '30 days'
      THEN 'churned'
    WHEN MAX(r.created_at) > NOW() - INTERVAL '30 days'
      THEN 'active'
    WHEN MAX(r.created_at) BETWEEN NOW() - INTERVAL '90 days' AND NOW() - INTERVAL '30 days'
      THEN 'dormant'
    ELSE 'churned'
  END             AS segment,
  (
    SELECT category_slug FROM requests
    WHERE client_id = u.id
    GROUP BY category_slug
    ORDER BY COUNT(*) DESC LIMIT 1
  )               AS top_category,
  (
    SELECT EXTRACT(EPOCH FROM (NOW() - MAX(sent_at))) / 86400
    FROM notification_log
    WHERE user_id = u.id
  )               AS days_since_last_notif
FROM users u
LEFT JOIN requests r ON r.client_id = u.id
WHERE u.role = 'client'
GROUP BY u.id, u.role, u.city, u.created_at;

-- 2b. public_provider_profiles
CREATE OR REPLACE VIEW public_provider_profiles
  WITH (security_invoker = true)
AS
SELECT
  pr.id,
  pr.username,
  pr.score,
  pr.reputation_tier,
  pr.lifetime_jobs,
  pr.badge_verified,
  pr.share_count,
  pr.profile_views,
  pr.categories,
  pr.bio,
  u.full_name,
  u.city
FROM providers pr
JOIN users u ON u.id = pr.id
WHERE pr.show_public = TRUE;

-- 2c. public_contract_feed
CREATE OR REPLACE VIEW public_contract_feed
  WITH (security_invoker = true)
AS
SELECT
  rc.*,
  u.full_name AS client_name,
  contract_total_visits(rc.frequency, rc.duration_months) AS total_visits,
  (SELECT COUNT(*) FROM contract_bids cb WHERE cb.contract_id = rc.id AND cb.status = 'pending') AS bids_count
FROM recurring_contracts rc
JOIN users u ON u.id = rc.client_id
WHERE rc.status = 'bidding';
