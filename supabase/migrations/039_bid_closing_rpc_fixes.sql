-- ============================================================
-- Migration 039: Update RPCs for Bid Closing
--
-- 1. accept_bid: allow accepting from 'reviewing' state
--    (client can still pick after bidding window closes)
-- 2. submit_bid_with_credits: block bids on non-open requests
--    and when max_bids already reached
-- ============================================================

-- ── 1. accept_bid ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION accept_bid(p_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bid    bids%ROWTYPE;
  v_caller UUID := (SELECT auth.uid());
  v_job_id UUID;
BEGIN
  SELECT * INTO v_bid FROM bids WHERE id = p_bid_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'bid_not_found_or_not_pending');
  END IF;

  -- Allow accepting from both 'open' and 'reviewing' states
  IF NOT EXISTS (
    SELECT 1 FROM requests
    WHERE id        = v_bid.request_id
      AND client_id = v_caller
      AND status    IN ('open', 'reviewing')
  ) THEN
    RETURN jsonb_build_object('error', 'not_authorized_or_request_closed');
  END IF;

  INSERT INTO jobs (request_id, bid_id, client_id, provider_id, status)
  VALUES (v_bid.request_id, v_bid.id, v_caller, v_bid.provider_id, 'active')
  RETURNING id INTO v_job_id;

  UPDATE bids SET status = 'accepted' WHERE id = p_bid_id;

  UPDATE bids
  SET    status = 'rejected'
  WHERE  request_id = v_bid.request_id
    AND  id        != p_bid_id;

  UPDATE requests
  SET    status = 'in_progress', updated_at = NOW()
  WHERE  id = v_bid.request_id;

  RETURN jsonb_build_object('job_id', v_job_id);
END;
$$;

REVOKE ALL ON FUNCTION accept_bid(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_bid(UUID) TO authenticated;

-- ── 2. submit_bid_with_credits ────────────────────────────────

CREATE OR REPLACE FUNCTION submit_bid_with_credits(
  p_request_id  UUID,
  p_provider_id UUID,
  p_amount      NUMERIC,
  p_note        TEXT,
  p_credit_cost INT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider       RECORD;
  v_request        RECORD;
  v_active_bids    INT;
  v_cooldown_count INT;
  v_pending_count  INT;
  v_bid_id         UUID;
BEGIN
  -- Load provider
  SELECT is_subscribed, subscription_tier, bid_credits
  INTO   v_provider
  FROM   providers
  WHERE  id = p_provider_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'PROVIDER_NOT_FOUND');
  END IF;

  -- Check subscription active
  IF NOT v_provider.is_subscribed THEN
    RETURN jsonb_build_object('error', 'NOT_SUBSCRIBED');
  END IF;

  -- Load request + validate it is still accepting bids
  SELECT client_id, status, max_bids
  INTO   v_request
  FROM   requests
  WHERE  id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'REQUEST_NOT_FOUND');
  END IF;

  IF v_request.status <> 'open' THEN
    RETURN jsonb_build_object('error', 'REQUEST_CLOSED');
  END IF;

  -- Check bid count has not already reached max
  SELECT COUNT(*)
  INTO   v_pending_count
  FROM   bids
  WHERE  request_id = p_request_id
    AND  status     = 'pending';

  IF v_pending_count >= v_request.max_bids THEN
    RETURN jsonb_build_object('error', 'REQUEST_FULL');
  END IF;

  -- Check credits (skip for premium = unlimited)
  IF v_provider.subscription_tier <> 'premium' THEN
    IF v_provider.bid_credits < p_credit_cost THEN
      RETURN jsonb_build_object('error', 'NO_CREDITS');
    END IF;
  END IF;

  -- Premium: max 5 concurrent pending bids
  IF v_provider.subscription_tier = 'premium' THEN
    SELECT COUNT(*) INTO v_active_bids
    FROM   bids
    WHERE  provider_id = p_provider_id
      AND  status      = 'pending';

    IF v_active_bids >= 5 THEN
      RETURN jsonb_build_object('error', 'MAX_ACTIVE_BIDS');
    END IF;
  END IF;

  -- Cooldown: any bid from this provider on same client rejected in last 24h
  SELECT COUNT(*) INTO v_cooldown_count
  FROM   bids   b
  JOIN   requests r ON r.id = b.request_id
  WHERE  b.provider_id = p_provider_id
    AND  r.client_id   = v_request.client_id
    AND  b.rejected_at > NOW() - INTERVAL '24 hours';

  IF v_cooldown_count > 0 THEN
    RETURN jsonb_build_object('error', 'COOLDOWN_ACTIVE');
  END IF;

  -- Deduct credits (not for premium)
  IF v_provider.subscription_tier <> 'premium' THEN
    UPDATE providers
    SET    bid_credits = bid_credits - p_credit_cost
    WHERE  id = p_provider_id;
  END IF;

  INSERT INTO bids (request_id, provider_id, amount, currency, note, credit_cost)
  VALUES (p_request_id, p_provider_id, p_amount, 'JOD', p_note, p_credit_cost)
  RETURNING id INTO v_bid_id;

  RETURN jsonb_build_object('bid_id', v_bid_id);
END;
$$;

REVOKE ALL ON FUNCTION submit_bid_with_credits(UUID, UUID, NUMERIC, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_bid_with_credits(UUID, UUID, NUMERIC, TEXT, INT) TO authenticated;
