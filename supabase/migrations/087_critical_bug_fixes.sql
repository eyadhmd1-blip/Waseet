-- ============================================================
-- Migration 087: Critical Bug Fixes
--
-- BUG-C04: accept_bid() — add SELECT FOR UPDATE on request row to
--          prevent race condition where two concurrent accepts on the
--          same request both pass the status check and create two jobs.
--
-- BUG-C05: Register sweep_expired_job_commitments() as a pg_cron job.
--          The function was created in migration 015 but never scheduled,
--          so expired provider commitment deadlines were never swept.
--
-- BUG-C06: track_bid_rejection() referenced the dropped `bid_credits`
--          column (removed in migration 055).  Every bid rejection fired
--          this trigger and failed at runtime, breaking consecutive-loss
--          tracking and perseverance-reward credits.
--          Fix: use `bonus_credits` (the correct column post-055).
--
-- BUG-H01: refund_bids_on_cancel() (fixed in 056) did not honour the
--          bonus_credits_used split on bids (added in 077).  Refund now
--          restores subscription_credits and bonus_credits proportionally.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- BUG-C04: accept_bid — lock request row with FOR UPDATE
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION accept_bid(p_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bid        bids%ROWTYPE;
  v_caller     UUID := (SELECT auth.uid());
  v_request_id UUID;
  v_job_id     UUID;
BEGIN
  -- 1. Fetch the bid (must still be pending)
  SELECT * INTO v_bid FROM bids WHERE id = p_bid_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'bid_not_found_or_not_pending');
  END IF;

  -- 2. Lock the request row to serialise concurrent accepts (BUG-C04).
  --    FOR UPDATE prevents two transactions from both reading status='open'
  --    before either one writes 'in_progress'.
  SELECT id INTO v_request_id
  FROM   requests
  WHERE  id        = v_bid.request_id
    AND  client_id = v_caller
    AND  status    IN ('open', 'reviewing')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_authorized_or_request_closed');
  END IF;

  -- 3. Create job
  INSERT INTO jobs (request_id, bid_id, client_id, provider_id, status)
  VALUES (v_bid.request_id, v_bid.id, v_caller, v_bid.provider_id, 'active')
  RETURNING id INTO v_job_id;

  -- 4. Mark winning bid as accepted
  UPDATE bids SET status = 'accepted' WHERE id = p_bid_id;

  -- 5. Reject all other bids on the same request
  UPDATE bids
  SET    status = 'rejected'
  WHERE  request_id = v_bid.request_id
    AND  id        != p_bid_id;

  -- 6. Move request to in_progress
  UPDATE requests
  SET    status = 'in_progress', updated_at = NOW()
  WHERE  id = v_bid.request_id;

  RETURN jsonb_build_object('job_id', v_job_id);
END;
$$;

REVOKE ALL ON FUNCTION accept_bid(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION accept_bid(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- BUG-C05: Register sweep_expired_job_commitments as cron
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM cron.unschedule('sweep-commitment-expiry');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'sweep-commitment-expiry',
  '* * * * *',
  'SELECT sweep_expired_job_commitments()'
);

GRANT EXECUTE ON FUNCTION sweep_expired_job_commitments() TO service_role;

-- ─────────────────────────────────────────────────────────────
-- BUG-C06: track_bid_rejection — replace bid_credits with bonus_credits
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION track_bid_rejection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total    INT;
  v_rejected INT;
  v_rate     NUMERIC(4,3);
  v_losses   INT;
  v_tier     subscription_tier;
BEGIN

  -- ── A. Handle rejection ─────────────────────────────────────
  IF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN

    -- Stamp rejected_at
    UPDATE bids
    SET    rejected_at = NOW()
    WHERE  id          = NEW.id
      AND  rejected_at IS NULL;

    -- Recalculate 30-day rejection rate
    SELECT
      COUNT(*) FILTER (WHERE status IN ('accepted', 'rejected')),
      COUNT(*) FILTER (WHERE status = 'rejected')
    INTO v_total, v_rejected
    FROM bids
    WHERE provider_id = NEW.provider_id
      AND created_at  > NOW() - INTERVAL '30 days';

    IF v_total > 0 THEN
      v_rate := ROUND(v_rejected::NUMERIC / v_total, 3);
    ELSE
      v_rate := 0.000;
    END IF;

    -- Increment consecutive_losses, get updated value + tier
    UPDATE providers
    SET    bid_rejection_rate = v_rate,
           consecutive_losses = consecutive_losses + 1
    WHERE  id = NEW.provider_id
    RETURNING consecutive_losses, subscription_tier
    INTO   v_losses, v_tier;

    -- Perseverance reward: every 7 consecutive losses → +1 bonus credit
    -- (non-premium only; premium has unlimited bids)
    IF v_losses % 7 = 0 THEN
      IF v_tier <> 'premium' THEN
        UPDATE providers
        SET    bonus_credits = bonus_credits + 1   -- was bid_credits (BUG-C06)
        WHERE  id = NEW.provider_id;
      END IF;
    END IF;

  END IF;

  -- ── B. Handle win — reset streak ────────────────────────────
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    UPDATE providers
    SET    consecutive_losses = 0
    WHERE  id = NEW.provider_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_bid_rejection ON bids;
CREATE TRIGGER trg_track_bid_rejection
  AFTER UPDATE OF status ON bids
  FOR EACH ROW
  EXECUTE FUNCTION track_bid_rejection();

-- ─────────────────────────────────────────────────────────────
-- BUG-H01: refund_bids_on_cancel — honour bonus_credits_used split
--
-- Migration 056 refunded ALL credits to subscription_credits (or
-- bonus_credits if subscription lapsed), ignoring that some credits
-- may have been drawn from the bonus wallet.  Migration 077 added the
-- bonus_credits_used column to bids.  We now refund each wallet the
-- correct amount.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION refund_bids_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'expired')
     AND OLD.status NOT IN ('cancelled', 'expired') THEN

    UPDATE providers p
    SET
      -- Subscription-wallet refund: total cost minus the bonus portion
      subscription_credits = CASE
        WHEN p.is_subscribed AND p.subscription_ends > NOW()
        THEN p.subscription_credits
               + (b.credit_cost - COALESCE(b.bonus_credits_used, 0))
        ELSE p.subscription_credits
      END,
      -- Bonus-wallet refund: the bonus portion (plus all if sub lapsed)
      bonus_credits = CASE
        WHEN p.is_subscribed AND p.subscription_ends > NOW()
        THEN p.bonus_credits + COALESCE(b.bonus_credits_used, 0)
        ELSE p.bonus_credits + b.credit_cost   -- sub lapsed: restore all as bonus
      END
    FROM bids b
    WHERE b.request_id        = NEW.id
      AND b.status            = 'pending'
      AND b.provider_id       = p.id
      AND p.subscription_tier <> 'premium';

    -- Mark all pending bids as rejected
    UPDATE bids
    SET  status      = 'rejected',
         rejected_at = NOW()
    WHERE request_id = NEW.id
      AND status     = 'pending';

  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refund_bids_on_cancel ON requests;
CREATE TRIGGER trg_refund_bids_on_cancel
  AFTER UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION refund_bids_on_cancel();
