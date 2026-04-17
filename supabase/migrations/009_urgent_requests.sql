-- ============================================================
-- Migration 009: Urgent Requests
-- Adds is_urgent flag to requests + provider availability status
-- ============================================================

-- ── Requests: urgent fields ──────────────────────────────────

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS is_urgent          BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS urgent_premium_pct INTEGER     NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS urgent_expires_at  TIMESTAMPTZ;

-- ── Providers: availability status ──────────────────────────

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS is_available   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS urgent_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- ── Indexes for fast urgent routing ─────────────────────────

CREATE INDEX IF NOT EXISTS idx_requests_urgent_open
  ON requests (city, category_slug, created_at DESC)
  WHERE is_urgent = TRUE AND status = 'open';

CREATE INDEX IF NOT EXISTS idx_providers_available_urgent
  ON providers (id)
  WHERE is_available = TRUE AND urgent_enabled = TRUE;

-- ── RPC: get available providers for urgent routing ──────────

CREATE OR REPLACE FUNCTION get_available_providers_for_urgent(
  p_city          TEXT,
  p_category_slug TEXT
)
RETURNS TABLE (provider_id UUID, token TEXT)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT DISTINCT
    pr.id   AS provider_id,
    pt.token
  FROM providers pr
  JOIN push_tokens pt ON pt.user_id = pr.id
  JOIN users u        ON u.id = pr.id
  WHERE pr.is_available   = TRUE
    AND pr.urgent_enabled = TRUE
    AND u.city            = p_city
    AND p_category_slug   = ANY(pr.categories)
  LIMIT 15;
$$;
