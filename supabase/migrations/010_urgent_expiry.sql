-- ============================================================
-- Migration 010: Urgent Request Expiry
-- Auto-cancels urgent requests whose urgent_expires_at has
-- passed and still have no accepted bid.
-- ============================================================

-- ── Function: expire stale urgent requests ───────────────────

CREATE OR REPLACE FUNCTION expire_urgent_requests()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE requests
  SET
    status    = 'cancelled',
    -- strip urgent flag so it doesn't show as "expired urgent" in feed
    is_urgent = FALSE
  WHERE
    is_urgent          = TRUE
    AND status         = 'open'
    AND urgent_expires_at < NOW()
    -- no accepted bid exists
    AND id NOT IN (
      SELECT DISTINCT request_id
      FROM bids
      WHERE status = 'accepted'
    );
END;
$$;

-- ── Cron: run every minute ───────────────────────────────────
-- Register in Supabase Dashboard → Database → Extensions → pg_cron
-- or via SQL after enabling the extension:
--
--   SELECT cron.schedule(
--     'expire-urgent-requests',
--     '* * * * *',
--     'SELECT expire_urgent_requests()'
--   );
--
-- This runs every minute which is fine for 60-minute SLA windows.
-- If pg_cron is not available, call this function from the
-- notify-urgent edge function's own scheduled cleanup instead.

-- ── Fallback: DB trigger on bids INSERT ─────────────────────
-- When any bid is accepted, immediately re-check if the urgent
-- window is still valid. If it expired before the bid was placed,
-- reject the bid and cancel the request.

CREATE OR REPLACE FUNCTION check_urgent_bid_timing()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  req RECORD;
BEGIN
  -- Only check urgent requests
  SELECT is_urgent, urgent_expires_at, status
  INTO req
  FROM requests
  WHERE id = NEW.request_id;

  IF req.is_urgent AND req.urgent_expires_at < NOW() THEN
    -- Window expired — auto-cancel the request
    UPDATE requests
    SET status = 'cancelled', is_urgent = FALSE
    WHERE id = NEW.request_id;

    RAISE EXCEPTION 'urgent_expired'
      USING MESSAGE = 'انتهت مهلة الطلب الطارئ قبل قبول العرض';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_check_urgent_bid_timing
  BEFORE INSERT ON bids
  FOR EACH ROW
  EXECUTE FUNCTION check_urgent_bid_timing();
