-- ============================================================
-- Migration 038: Smart Bid Closing
--
-- Every request now has a hard cap on bids AND a time window.
-- Bidding closes automatically when either limit is hit first,
-- moving the request from 'open' → 'reviewing' so the client
-- can pick a provider.
--
-- Limits (per product spec):
--   Normal request  : 7 bids  / 24 hours
--   Urgent request  : 4 bids  / same as urgent_expires_at (60 min)
--   Recurring contract: 10 bids / 3 days
--
-- Credit refund:
--   If a request is cancelled (client cancels or urgent expires
--   with no winner), all pending bid credits are refunded.
-- ============================================================

-- ── 1. Add 'reviewing' to enums ──────────────────────────────

ALTER TYPE request_status  ADD VALUE IF NOT EXISTS 'reviewing'  AFTER 'open';
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'reviewing'  AFTER 'bidding';

-- ── 2. Add columns to requests ───────────────────────────────

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS max_bids        INT         NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS bidding_ends_at TIMESTAMPTZ;

-- ── 3. Add columns to recurring_contracts ────────────────────

ALTER TABLE recurring_contracts
  ADD COLUMN IF NOT EXISTS max_bids        INT         NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS bidding_ends_at TIMESTAMPTZ;

-- ── 4. BEFORE INSERT trigger: set bidding window on requests ─

CREATE OR REPLACE FUNCTION set_request_bidding_window()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_urgent THEN
    -- Urgent: 4 bids, window tied to the urgent expiry (60 min from app)
    NEW.max_bids        := 4;
    NEW.bidding_ends_at := COALESCE(NEW.urgent_expires_at, NOW() + INTERVAL '2 hours');
  ELSE
    -- Normal: 7 bids, 24-hour window
    NEW.max_bids        := 7;
    NEW.bidding_ends_at := NOW() + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_request_bidding_window ON requests;
CREATE TRIGGER trg_set_request_bidding_window
  BEFORE INSERT ON requests
  FOR EACH ROW
  EXECUTE FUNCTION set_request_bidding_window();

-- ── 5. BEFORE INSERT trigger: set bidding window on contracts ─

CREATE OR REPLACE FUNCTION set_contract_bidding_window()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.max_bids        := 10;
  NEW.bidding_ends_at := NOW() + INTERVAL '3 days';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_contract_bidding_window ON recurring_contracts;
CREATE TRIGGER trg_set_contract_bidding_window
  BEFORE INSERT ON recurring_contracts
  FOR EACH ROW
  EXECUTE FUNCTION set_contract_bidding_window();

-- ── 6. AFTER INSERT trigger: close request when max bids hit ─

CREATE OR REPLACE FUNCTION check_bid_count_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status   request_status;
  v_max_bids INT;
  v_count    INT;
BEGIN
  -- Lock the request row to prevent concurrent race conditions
  SELECT status, max_bids
  INTO   v_status, v_max_bids
  FROM   requests
  WHERE  id = NEW.request_id
  FOR UPDATE;

  IF v_status <> 'open' THEN
    RETURN NEW; -- already closed / in-progress / etc.
  END IF;

  SELECT COUNT(*)
  INTO   v_count
  FROM   bids
  WHERE  request_id = NEW.request_id
    AND  status     = 'pending';

  IF v_count >= v_max_bids THEN
    UPDATE requests
    SET    status = 'reviewing', updated_at = NOW()
    WHERE  id = NEW.request_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_bid_count_close ON bids;
CREATE TRIGGER trg_check_bid_count_close
  AFTER INSERT ON bids
  FOR EACH ROW
  EXECUTE FUNCTION check_bid_count_close();

-- ── 7. AFTER INSERT trigger: close contract when max bids hit ─

CREATE OR REPLACE FUNCTION check_contract_bid_count_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status   contract_status;
  v_max_bids INT;
  v_count    INT;
BEGIN
  SELECT status, max_bids
  INTO   v_status, v_max_bids
  FROM   recurring_contracts
  WHERE  id = NEW.contract_id
  FOR UPDATE;

  IF v_status <> 'bidding' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
  INTO   v_count
  FROM   contract_bids
  WHERE  contract_id = NEW.contract_id
    AND  status      = 'pending';

  IF v_count >= v_max_bids THEN
    UPDATE recurring_contracts
    SET    status = 'reviewing', updated_at = NOW()
    WHERE  id = NEW.contract_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_contract_bid_count_close ON contract_bids;
CREATE TRIGGER trg_check_contract_bid_count_close
  AFTER INSERT ON contract_bids
  FOR EACH ROW
  EXECUTE FUNCTION check_contract_bid_count_close();

-- ── 8. Cron function: close time-expired bidding windows ──────

CREATE OR REPLACE FUNCTION close_expired_bidding()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Close normal requests whose 24-hour window has passed
  UPDATE requests
  SET    status = 'reviewing', updated_at = NOW()
  WHERE  status          = 'open'
    AND  is_urgent        = FALSE
    AND  bidding_ends_at  < NOW();

  -- Close recurring contracts whose 3-day window has passed
  UPDATE recurring_contracts
  SET    status = 'reviewing', updated_at = NOW()
  WHERE  status          = 'bidding'
    AND  bidding_ends_at  < NOW();
END;
$$;

-- ── 9. Register cron: every 15 minutes ───────────────────────

DO $$
BEGIN
  PERFORM cron.unschedule('close-expired-bidding');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'close-expired-bidding',
  '*/15 * * * *',
  'SELECT close_expired_bidding()'
);

-- ── 10. Credit refund on request cancellation ────────────────
-- When a request is cancelled (by client or by urgent expiry),
-- refund pending bid credits to each provider.

CREATE OR REPLACE FUNCTION refund_bids_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    -- Refund credits to non-premium providers who had pending bids
    UPDATE providers p
    SET    bid_credits = bid_credits + b.credit_cost
    FROM   bids b
    WHERE  b.request_id           = NEW.id
      AND  b.status               = 'pending'
      AND  b.provider_id          = p.id
      AND  p.subscription_tier    <> 'premium';

    -- Mark all pending bids as rejected
    UPDATE bids
    SET    status      = 'rejected',
           rejected_at = NOW()
    WHERE  request_id  = NEW.id
      AND  status      = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refund_bids_on_cancel ON requests;
CREATE TRIGGER trg_refund_bids_on_cancel
  AFTER UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION refund_bids_on_cancel();

-- ── 11. Index: speed up time-based cron query ────────────────

CREATE INDEX IF NOT EXISTS idx_requests_bidding_ends
  ON requests (bidding_ends_at)
  WHERE status = 'open' AND is_urgent = FALSE;

CREATE INDEX IF NOT EXISTS idx_contracts_bidding_ends
  ON recurring_contracts (bidding_ends_at)
  WHERE status = 'bidding';
