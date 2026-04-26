-- ============================================================
-- Migration 046 — Request Expiry & No-Bid Rescue System
--
-- Adds:
--   1. `expired` status to request_status enum
--   2. Tracking columns on requests (avoid duplicate notifications)
--   3. expire_stale_requests()     — closes open requests with no bids after 48h
--   4. renotify_providers_for_stale_requests() — re-alerts providers at 2h
--   5. flag_clients_no_bids()      — marks requests ready for 6h client push
--   6. pg_cron registrations
--
-- Decision: applies to ALL existing open requests (not only new ones).
-- ============================================================

-- ── 1. Extend enum ───────────────────────────────────────────
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'expired';

-- ── 2. Tracking columns ──────────────────────────────────────
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS provider_renotified_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_notified_no_bids_at  TIMESTAMPTZ;

-- Indexes for the cron sweep queries
CREATE INDEX IF NOT EXISTS idx_requests_open_created
  ON requests (created_at)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_requests_no_bids_notify
  ON requests (created_at, client_notified_no_bids_at)
  WHERE status = 'open' AND client_notified_no_bids_at IS NULL;

-- ── 3. expire_stale_requests() ───────────────────────────────
-- Closes open requests older than 48 hours that still have
-- no pending or accepted bids. Applies to ALL existing requests.

CREATE OR REPLACE FUNCTION expire_stale_requests()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
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
      AND created_at < NOW() - INTERVAL '48 hours'
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

-- ── 4. renotify_providers_for_stale_requests() ───────────────
-- At 2 hours: inserts in-app notifications for all subscribed
-- providers who match the request city + category and haven't
-- been re-notified yet. Runs once per request (idempotent).

CREATE OR REPLACE FUNCTION renotify_providers_for_stale_requests()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Insert notifications for matching providers
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
    AND r.created_at           > NOW() - INTERVAL '48 hours'
    AND r.provider_renotified_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM bids
      WHERE bids.request_id = r.id
    )
    -- Don't re-notify a provider who already bid on this request
    AND NOT EXISTS (
      SELECT 1 FROM bids b2
      WHERE b2.request_id = r.id
        AND b2.provider_id = p.id
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Mark requests as re-notified (idempotent)
  UPDATE requests
  SET provider_renotified_at = NOW()
  WHERE
    status                   = 'open'
    AND created_at           < NOW() - INTERVAL '2 hours'
    AND created_at           > NOW() - INTERVAL '48 hours'
    AND provider_renotified_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM bids WHERE bids.request_id = requests.id
    );

  RETURN v_count;
END;
$$;

-- ── 5. flag_clients_no_bids() ────────────────────────────────
-- At 6 hours: marks requests that are ready for client push
-- notification. The actual push is sent by the notify-no-bids
-- edge function which reads this flag.
-- Returns the request IDs that need a push (for edge fn to process).

CREATE OR REPLACE FUNCTION flag_clients_no_bids()
RETURNS TABLE (
  request_id    UUID,
  client_id     UUID,
  request_title TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH flagged AS (
    UPDATE requests
    SET client_notified_no_bids_at = NOW()
    WHERE
      status                        = 'open'
      AND created_at                < NOW() - INTERVAL '6 hours'
      AND created_at                > NOW() - INTERVAL '48 hours'
      AND client_notified_no_bids_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM bids WHERE bids.request_id = requests.id
      )
    RETURNING id, client_id, title
  )
  SELECT id, client_id, title FROM flagged;
END;
$$;

-- ── 6. pg_cron registrations ─────────────────────────────────

-- Expire stale requests — every 30 minutes
DO $$
BEGIN
  PERFORM cron.unschedule('expire-stale-requests');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'expire-stale-requests',
  '*/30 * * * *',
  'SELECT expire_stale_requests()'
);

-- Re-notify providers — every 30 minutes
DO $$
BEGIN
  PERFORM cron.unschedule('renotify-providers-stale');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'renotify-providers-stale',
  '*/30 * * * *',
  'SELECT renotify_providers_for_stale_requests()'
);

-- ── Verification ─────────────────────────────────────────────
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname IN
--   ('expire-stale-requests','renotify-providers-stale');
--
-- SELECT COUNT(*) FROM requests WHERE status = 'expired';
