-- ============================================================
-- Migration 066: get_providers_for_new_request
-- RPC used by the notify-new-request Edge Function to find
-- all providers that should receive a push when a new normal
-- (non-urgent) request is posted.
--
-- Tier rules:
--   Tier 1 — active subscriber (is_subscribed=true)
--             → always include, normal bid rights
--   Tier 2 — recently lapsed (≤30 days since subscription_ends)
--             → always include, "renew to bid" copy
--   Tier 3 — medium-inactive (31–90 days since subscription_ends)
--             → include only if not notified with type='new_request'
--               in the last 24 hours (1 notification/day max)
--   Tier 4 (>90 days) → excluded entirely
-- ============================================================

-- ── Index to speed up the 24h cooldown check ─────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_new_request_cooldown
  ON notifications (user_id, created_at DESC)
  WHERE type = 'new_request';

-- ── RPC ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_providers_for_new_request(
  p_city          TEXT,
  p_category_slug TEXT
)
RETURNS TABLE (
  provider_id UUID,
  token       TEXT,
  is_active   BOOLEAN,
  days_lapsed INT
)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (pr.id)
    pr.id AS provider_id,
    pt.token,
    pr.is_subscribed AS is_active,
    CASE
      WHEN pr.is_subscribed = TRUE      THEN 0
      WHEN pr.subscription_ends IS NULL THEN 999
      ELSE GREATEST(0, EXTRACT(DAY FROM (NOW() - pr.subscription_ends))::INT)
    END AS days_lapsed
  FROM providers pr
  JOIN push_tokens pt ON pt.user_id = pr.id
                      AND pt.token IS NOT NULL
                      AND pt.token <> ''
  JOIN users u        ON u.id = pr.id
  WHERE u.city            = p_city
    AND p_category_slug   = ANY(pr.categories)
    AND (
      -- Tier 1: active subscriber
      pr.is_subscribed = TRUE

      OR
      -- Tier 2: lapsed ≤ 30 days — notify freely
      (
        pr.is_subscribed    = FALSE
        AND pr.subscription_ends IS NOT NULL
        AND pr.subscription_ends > NOW() - INTERVAL '30 days'
      )

      OR
      -- Tier 3: lapsed 31–90 days — max 1 notification per 24 hours
      (
        pr.is_subscribed    = FALSE
        AND pr.subscription_ends IS NOT NULL
        AND pr.subscription_ends BETWEEN NOW() - INTERVAL '90 days'
                                     AND NOW() - INTERVAL '30 days'
        AND NOT EXISTS (
          SELECT 1
          FROM   notifications n
          WHERE  n.user_id    = pr.id
            AND  n.type       = 'new_request'
            AND  n.created_at > NOW() - INTERVAL '24 hours'
        )
      )
    )
  ORDER BY pr.id, pt.updated_at DESC  -- pick the most-recently-used token per provider
  LIMIT 300;
$$;

GRANT EXECUTE ON FUNCTION get_providers_for_new_request(TEXT, TEXT) TO service_role;
