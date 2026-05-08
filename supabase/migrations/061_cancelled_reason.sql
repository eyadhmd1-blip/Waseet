-- ============================================================
-- Migration 061: Cancelled Reason
-- Adds cancelled_reason column to requests so the UI can show
-- a contextual message explaining why a request was cancelled.
-- Values: 'by_client' | 'urgent_expired' | 'by_admin'
-- ============================================================

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

-- Update expire_urgent_requests() to record the reason
CREATE OR REPLACE FUNCTION expire_urgent_requests()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE requests
  SET
    status           = 'cancelled',
    cancelled_reason = 'urgent_expired',
    is_urgent        = FALSE
  WHERE
    is_urgent          = TRUE
    AND status         = 'open'
    AND urgent_expires_at < NOW()
    AND id NOT IN (
      SELECT DISTINCT request_id
      FROM bids
      WHERE status = 'accepted'
    );
END;
$$;

-- Update check_urgent_bid_timing() to record the reason
CREATE OR REPLACE FUNCTION check_urgent_bid_timing()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  req RECORD;
BEGIN
  SELECT is_urgent, urgent_expires_at, status
  INTO req
  FROM requests
  WHERE id = NEW.request_id;

  IF req.is_urgent AND req.urgent_expires_at < NOW() THEN
    UPDATE requests
    SET status = 'cancelled', cancelled_reason = 'urgent_expired', is_urgent = FALSE
    WHERE id = NEW.request_id;

    RAISE EXCEPTION 'urgent_expired'
      USING MESSAGE = 'انتهت مهلة الطلب الطارئ قبل قبول العرض';
  END IF;

  RETURN NEW;
END;
$$;
