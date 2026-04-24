-- ============================================================
-- WASEET — Migration 033: Contract Notification RPC
-- When a new recurring contract is posted, notify subscribed
-- providers in the same city who offer that category.
-- ============================================================

CREATE OR REPLACE FUNCTION get_available_providers_for_contract(
  p_city          TEXT,
  p_category_slug TEXT
)
RETURNS TABLE (provider_id UUID, token TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT DISTINCT
    pr.id   AS provider_id,
    pt.token
  FROM providers pr
  JOIN push_tokens pt ON pt.user_id = pr.id
  JOIN users u        ON u.id = pr.id
  WHERE pr.is_available    = TRUE
    AND pr.is_subscribed   = TRUE
    AND u.city             = p_city
    AND p_category_slug    = ANY(pr.categories)
  LIMIT 50;
$$;
