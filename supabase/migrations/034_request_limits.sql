-- ============================================================
-- WASEET — Migration 034: Client Request Limits
-- Rules:
--   1. Max 1 open request per category per client at any time
--   2. Max 5 open requests total per client at any time
-- "Open" means status = 'open' only (accepted/completed/cancelled don't count)
-- ============================================================

CREATE OR REPLACE FUNCTION check_request_limits(
  p_client_id     UUID,
  p_category_slug TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_total_open    INT;
  v_category_open INT;
BEGIN
  -- Count all open requests for this client
  SELECT COUNT(*) INTO v_total_open
  FROM requests
  WHERE client_id = p_client_id
    AND status    = 'open';

  IF v_total_open >= 5 THEN
    RETURN 'TOTAL_LIMIT';
  END IF;

  -- Count open requests in this specific category
  SELECT COUNT(*) INTO v_category_open
  FROM requests
  WHERE client_id     = p_client_id
    AND category_slug = p_category_slug
    AND status        = 'open';

  IF v_category_open >= 1 THEN
    RETURN 'CATEGORY_LIMIT';
  END IF;

  RETURN 'OK';
END;
$$;
