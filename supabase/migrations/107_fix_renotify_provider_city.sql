-- ============================================================
-- Migration 107 — Fix renotify_providers_for_stale_requests()
--
-- BUG: the function joined providers on `p.city = r.city`, but the
-- `providers` table has NO `city` column — a provider's city lives on
-- the `users` row (providers.id REFERENCES users.id). Every run failed
-- at parse time with: ERROR: column p.city does not exist.
--
-- Effect (non-critical): the "request still has no bids after 2h"
-- re-reminder never reached providers. Core notifications (new request,
-- new bid, accepted) were unaffected — they run via separate triggers.
--
-- FIX: join `users` to read the provider's city. All other logic
-- (7-day window from migration 093, idempotent UPDATE) is unchanged.
-- ============================================================

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
    ON r.category_slug   = ANY(p.categories)
   AND p.is_subscribed   = TRUE
  JOIN users pu                       -- provider's user row (providers.id = users.id)
    ON pu.id   = p.id
   AND pu.city = r.city               -- city lives on users, not providers
  WHERE
    r.status                     = 'open'
    AND r.created_at             < NOW() - INTERVAL '2 hours'
    AND r.created_at             > NOW() - INTERVAL '7 days'
    AND r.provider_renotified_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM bids
      WHERE bids.request_id = r.id
    )
    -- Don't re-notify a provider who already bid on this request
    AND NOT EXISTS (
      SELECT 1 FROM bids b2
      WHERE b2.request_id  = r.id
        AND b2.provider_id = p.id
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Mark requests as re-notified (idempotent)
  UPDATE requests
  SET provider_renotified_at = NOW()
  WHERE
    status                     = 'open'
    AND created_at             < NOW() - INTERVAL '2 hours'
    AND created_at             > NOW() - INTERVAL '7 days'
    AND provider_renotified_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM bids WHERE bids.request_id = requests.id
    );

  RETURN v_count;
END;
$$;
