-- ============================================================
-- Migration 069: Fix submit_bid_with_credits — correct two-wallet
-- system + exclude cancelled/expired requests from cooldown.
--
-- Migration 068 accidentally replaced the two-wallet version of
-- submit_bid_with_credits (from 055) with the old single-wallet
-- version (from 019) that references the dropped bid_credits column.
-- This migration restores the correct 055 logic and adds the
-- cooldown fix: cancelled/expired requests must not count.
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
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_provider       RECORD;
  v_client_id      UUID;
  v_active_bids    INT;
  v_max_bids       INT;
  v_cooldown_count INT;
  v_bid_id         UUID;
  v_from_bonus     INT;
BEGIN
  -- Load provider
  SELECT is_subscribed, subscription_tier, subscription_ends,
         subscription_credits, bonus_credits
  INTO   v_provider
  FROM   providers
  WHERE  id = p_provider_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'PROVIDER_NOT_FOUND');
  END IF;

  -- Check subscription active
  IF NOT v_provider.is_subscribed OR v_provider.subscription_ends < NOW() THEN
    RETURN jsonb_build_object(
      'error',        'SUBSCRIPTION_EXPIRED',
      'bonus_credits', v_provider.bonus_credits
    );
  END IF;

  IF v_provider.subscription_tier = 'premium' THEN
    -- Premium: dynamic bid cap = 5 + FLOOR(bonus/5), max 8
    v_max_bids := LEAST(5 + FLOOR(v_provider.bonus_credits::NUMERIC / 5)::INT, 8);

    SELECT COUNT(*) INTO v_active_bids
    FROM   bids
    WHERE  provider_id = p_provider_id
      AND  status      = 'pending';

    IF v_active_bids >= v_max_bids THEN
      RETURN jsonb_build_object(
        'error', 'MAX_ACTIVE_BIDS',
        'max',   v_max_bids
      );
    END IF;

  ELSE
    -- Non-premium: spend subscription_credits first, then bonus_credits
    IF v_provider.subscription_credits >= p_credit_cost THEN
      UPDATE providers
      SET subscription_credits = subscription_credits - p_credit_cost
      WHERE id = p_provider_id;

    ELSIF (v_provider.subscription_credits + v_provider.bonus_credits) >= p_credit_cost THEN
      v_from_bonus := p_credit_cost - v_provider.subscription_credits;
      UPDATE providers
      SET subscription_credits = 0,
          bonus_credits        = bonus_credits - v_from_bonus
      WHERE id = p_provider_id;

    ELSE
      RETURN jsonb_build_object('error', 'NO_CREDITS');
    END IF;
  END IF;

  -- Get client_id for cooldown check
  SELECT client_id INTO v_client_id
  FROM   requests
  WHERE  id = p_request_id;

  IF NOT FOUND THEN
    -- Refund credits before returning error
    IF v_provider.subscription_tier <> 'premium' THEN
      IF v_provider.subscription_credits >= p_credit_cost THEN
        UPDATE providers SET subscription_credits = subscription_credits + p_credit_cost WHERE id = p_provider_id;
      ELSE
        v_from_bonus := p_credit_cost - v_provider.subscription_credits;
        UPDATE providers SET
          subscription_credits = v_provider.subscription_credits,
          bonus_credits        = bonus_credits + v_from_bonus
        WHERE id = p_provider_id;
      END IF;
    END IF;
    RETURN jsonb_build_object('error', 'REQUEST_NOT_FOUND');
  END IF;

  -- Cooldown: provider had a bid rejected by client choosing another provider
  -- on any request by this client in the last 24 hours.
  -- Excludes cancelled/expired requests — those are administrative refunds,
  -- not client-initiated rejections of the provider's offer.
  SELECT COUNT(*) INTO v_cooldown_count
  FROM   bids     b
  JOIN   requests r ON r.id = b.request_id
  WHERE  b.provider_id = p_provider_id
    AND  r.client_id   = v_client_id
    AND  b.rejected_at > NOW() - INTERVAL '24 hours'
    AND  r.status NOT IN ('cancelled', 'expired');

  IF v_cooldown_count > 0 THEN
    -- Refund credits that were deducted before cooldown check
    IF v_provider.subscription_tier <> 'premium' THEN
      IF v_provider.subscription_credits >= p_credit_cost THEN
        UPDATE providers SET subscription_credits = subscription_credits + p_credit_cost WHERE id = p_provider_id;
      ELSE
        v_from_bonus := p_credit_cost - v_provider.subscription_credits;
        UPDATE providers SET
          subscription_credits = v_provider.subscription_credits,
          bonus_credits        = bonus_credits + v_from_bonus
        WHERE id = p_provider_id;
      END IF;
    END IF;
    RETURN jsonb_build_object('error', 'COOLDOWN_ACTIVE');
  END IF;

  -- Insert bid
  INSERT INTO bids (request_id, provider_id, amount, currency, note, credit_cost)
  VALUES (p_request_id, p_provider_id, p_amount, 'JOD', p_note, p_credit_cost)
  RETURNING id INTO v_bid_id;

  RETURN jsonb_build_object('bid_id', v_bid_id);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_bid_with_credits(UUID, UUID, NUMERIC, TEXT, INT) TO authenticated;
