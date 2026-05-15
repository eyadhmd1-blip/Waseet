-- ============================================================
-- Migration 093 — Fix Request Expiry Window: 48h → 7 days
--
-- Fixes discrepancy between QA test spec (REQ-007: 7 days) and
-- the original 046 migration (48 hours). All three functions
-- that reference the expiry window are updated:
--   1. expire_stale_requests()
--   2. renotify_providers_for_stale_requests()
--   3. flag_clients_no_bids()
-- ============================================================

-- ── 1. expire_stale_requests() ───────────────────────────────
-- Closes open requests older than 7 days with no bids.

CREATE OR REPLACE FUNCTION expire_stale_requests()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH expired AS (
    UPDATE requests
    SET
      status     = 'expired',
      updated_at = NOW()
    WHERE
      status       = 'open'
      AND created_at < NOW() - INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM bids
        WHERE bids.request_id = requests.id
          AND bids.status IN ('pending', 'accepted')
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM expired;

  RETURN v_count;
END;
$$;

-- ── 2. renotify_providers_for_stale_requests() ───────────────
-- Re-alerts providers for requests between 2h and 7 days old
-- that still have no bids.

CREATE OR REPLACE FUNCTION renotify_providers_for_stale_requests()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO notifications (user_id, title, body, screen, metadata, created_at)
  SELECT DISTINCT
    p.id,
    'تذكير: طلب لم يُستجب له بعد',
    r.title,
    'provider_feed',
    jsonb_build_object('request_id', r.id, 'type', 'renotify'),
    NOW()
  FROM requests r
  JOIN providers p
    ON p.city            = r.city
   AND r.category_slug   = ANY(p.categories)
   AND p.is_subscribed   = TRUE
  WHERE
    r.status                   = 'open'
    AND r.created_at           < NOW() - INTERVAL '2 hours'
    AND r.created_at           > NOW() - INTERVAL '7 days'
    AND r.provider_renotified_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM bids
      WHERE bids.request_id = r.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM bids b2
      WHERE b2.request_id = r.id
        AND b2.provider_id = p.id
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE requests
  SET provider_renotified_at = NOW()
  WHERE
    status                   = 'open'
    AND created_at           < NOW() - INTERVAL '2 hours'
    AND created_at           > NOW() - INTERVAL '7 days'
    AND provider_renotified_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM bids WHERE bids.request_id = requests.id
    );

  RETURN v_count;
END;
$$;

-- ── 3. flag_clients_no_bids() ────────────────────────────────
-- Flags requests between 6h and 7 days old for client push.

CREATE OR REPLACE FUNCTION flag_clients_no_bids()
RETURNS TABLE (
  request_id    UUID,
  client_id     UUID,
  request_title TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH flagged AS (
    UPDATE requests
    SET client_notified_no_bids_at = NOW()
    WHERE
      status                        = 'open'
      AND created_at                < NOW() - INTERVAL '6 hours'
      AND created_at                > NOW() - INTERVAL '7 days'
      AND client_notified_no_bids_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM bids WHERE bids.request_id = requests.id
      )
    RETURNING id, client_id, title
  )
  SELECT id, client_id, title FROM flagged;
END;
$$;
