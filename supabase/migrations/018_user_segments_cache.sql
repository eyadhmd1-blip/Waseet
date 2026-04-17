-- ============================================================
-- Migration 018: Materialised User Segments Cache
--
-- Problem: user_segments is a non-materialised view with two
-- correlated subqueries per user row (top_category and
-- days_since_last_notif). At 1M users, querying it causes an
-- O(n²) scan that will exhaust the edge function timeout.
--
-- Solution: a physical table refreshed nightly at 03:00 UTC
-- (06:00 Jordan time) by pg_cron, well before the notification
-- engine runs at 06:00 UTC. The engine reads the static
-- snapshot — all queries are indexed, O(1) per lookup.
-- ============================================================

-- ── 1. Cache table ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_segments_cache (
  user_id               UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role                  user_role,
  city                  TEXT,
  created_at_user       TIMESTAMPTZ,              -- user registration date (renamed to avoid ambiguity)
  total_requests        BIGINT      NOT NULL DEFAULT 0,
  last_request_at       TIMESTAMPTZ,
  segment               TEXT        NOT NULL DEFAULT 'new', -- 'new'|'active'|'dormant'|'churned'
  top_category          TEXT,
  days_since_last_notif NUMERIC,
  refreshed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes used by the notification engine
CREATE INDEX IF NOT EXISTS idx_usc_segment
  ON user_segments_cache (segment);

CREATE INDEX IF NOT EXISTS idx_usc_city_segment
  ON user_segments_cache (city, segment);

-- Row Level Security — service role only (edge functions use service role key)
ALTER TABLE user_segments_cache ENABLE ROW LEVEL SECURITY;
-- No authenticated policies: this table is internal infrastructure.
-- The notification engine always uses the service-role client.

-- ── 2. Refresh function ──────────────────────────────────────
--
-- Runs an UPSERT from the live user_segments view into the
-- cache table. The view's correlated subqueries run once per
-- refresh (not once per notification send), at 3AM when load
-- is minimal.

CREATE OR REPLACE FUNCTION refresh_user_segments_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_segments_cache (
    user_id,
    role,
    city,
    created_at_user,
    total_requests,
    last_request_at,
    segment,
    top_category,
    days_since_last_notif,
    refreshed_at
  )
  SELECT
    user_id,
    role,
    city,
    created_at          AS created_at_user,
    total_requests,
    last_request_at,
    segment::TEXT,
    top_category,
    days_since_last_notif,
    NOW()
  FROM user_segments       -- the existing non-materialised view
  ON CONFLICT (user_id) DO UPDATE SET
    role                  = EXCLUDED.role,
    city                  = EXCLUDED.city,
    created_at_user       = EXCLUDED.created_at_user,
    total_requests        = EXCLUDED.total_requests,
    last_request_at       = EXCLUDED.last_request_at,
    segment               = EXCLUDED.segment,
    top_category          = EXCLUDED.top_category,
    days_since_last_notif = EXCLUDED.days_since_last_notif,
    refreshed_at          = NOW();

  -- Remove rows for users who have been deleted
  -- (ON DELETE CASCADE handles this, but clean up stragglers)
  DELETE FROM user_segments_cache
  WHERE user_id NOT IN (SELECT id FROM users);
END;
$$;

-- ── 3. Initial population ────────────────────────────────────
-- Populate on first migration run so the engine can start
-- immediately without waiting for the first cron.

SELECT refresh_user_segments_cache();

-- ── 4. Register pg_cron job ──────────────────────────────────
-- PREREQUISITE: pg_cron must be enabled (see migration 017).
-- Runs at 03:00 UTC (06:00 Jordan time) — 3 hours before the
-- notification engine fires, ensuring a fresh snapshot.

DO $$
BEGIN
  PERFORM cron.unschedule('refresh-user-segments');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'refresh-user-segments',
  '0 3 * * *',
  'SELECT refresh_user_segments_cache()'
);

-- ── Verification ─────────────────────────────────────────────
--
--   SELECT COUNT(*) FROM user_segments_cache;
--   SELECT segment, COUNT(*) FROM user_segments_cache GROUP BY segment;
--   SELECT * FROM cron.job WHERE jobname = 'refresh-user-segments';
