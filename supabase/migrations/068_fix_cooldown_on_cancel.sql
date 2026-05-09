-- ============================================================
-- Migration 068: Fix false COOLDOWN_ACTIVE on cancelled requests
--
-- Bug: When a client cancels a request, refund_bids_on_cancel()
-- sets all pending bids to status='rejected' with rejected_at=NOW().
-- The cooldown check in submit_bid_with_credits then sees these
-- rejected_at timestamps and blocks the provider from bidding on
-- the client's NEW request for 24 hours — even though the client
-- was the one who cancelled, not the provider being penalised.
--
-- Fix: Exclude bids whose parent request is 'cancelled' or
-- 'expired' from the cooldown window. Cooldown should only fire
-- when the client actively chose a different provider.
-- ============================================================

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
  v_client_id      UUID;
  v_active_bids    INT;
  v_cooldown_count INT;
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

  -- Get the request's client_id for cooldown check
  SELECT client_id INTO v_client_id
  FROM   requests
  WHERE  id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'REQUEST_NOT_FOUND');
  END IF;

  -- Cooldown: provider had a bid rejected (by client choosing another
  -- provider) on any request by this client in the last 24 hours.
  -- Excludes cancelled/expired requests — those rejections are
  -- administrative refunds, not client-initiated rejections.
  SELECT COUNT(*) INTO v_cooldown_count
  FROM   bids     b
  JOIN   requests r ON r.id = b.request_id
  WHERE  b.provider_id = p_provider_id
    AND  r.client_id   = v_client_id
    AND  b.rejected_at > NOW() - INTERVAL '24 hours'
    AND  r.status NOT IN ('cancelled', 'expired');

  IF v_cooldown_count > 0 THEN
    RETURN jsonb_build_object('error', 'COOLDOWN_ACTIVE');
  END IF;

  -- Deduct credits (not for premium)
  IF v_provider.subscription_tier <> 'premium' THEN
    UPDATE providers
    SET    bid_credits = bid_credits - p_credit_cost
    WHERE  id = p_provider_id;
  END IF;

  -- Insert bid
  INSERT INTO bids (request_id, provider_id, amount, currency, note, credit_cost)
  VALUES (p_request_id, p_provider_id, p_amount, 'JOD', p_note, p_credit_cost)
  RETURNING id INTO v_bid_id;

  RETURN jsonb_build_object('bid_id', v_bid_id);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_bid_with_credits(UUID, UUID, NUMERIC, TEXT, INT) TO authenticated;
