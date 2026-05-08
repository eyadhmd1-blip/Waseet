-- ============================================================
-- Migration 058 — Remove concurrent bid cap (growth phase)
--
-- Removes the MAX_ACTIVE_BIDS check from both bid submission RPCs.
-- Credit costs and rejection-rate ranking remain as natural spam
-- deterrents. The cap can be re-added later if abuse data warrants it.
-- ============================================================

-- ── Recreate submit_bid_with_credits without cap check ────────
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
  v_cooldown_count INT;
  v_bid_id         UUID;
  v_from_bonus     INT := 0;
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
      'error',         'SUBSCRIPTION_EXPIRED',
      'bonus_credits', v_provider.bonus_credits
    );
  END IF;

  -- ── Credit deduction (non-premium only) ──────────────────────
  IF v_provider.subscription_tier <> 'premium' THEN
    IF v_provider.subscription_credits >= p_credit_cost THEN
      UPDATE providers
      SET subscription_credits = subscription_credits - p_credit_cost
      WHERE id = p_provider_id;
      v_from_bonus := 0;

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

  -- ── Get client_id for cooldown check ─────────────────────────
  SELECT client_id INTO v_client_id
  FROM   requests
  WHERE  id = p_request_id;

  IF NOT FOUND THEN
    IF v_provider.subscription_tier <> 'premium' THEN
      UPDATE providers SET
        subscription_credits = subscription_credits + (p_credit_cost - v_from_bonus),
        bonus_credits        = bonus_credits        + v_from_bonus
      WHERE id = p_provider_id;
    END IF;
    RETURN jsonb_build_object('error', 'REQUEST_NOT_FOUND');
  END IF;

  -- ── Cooldown: rejected bid on any request from same client in 24h ──
  SELECT COUNT(*) INTO v_cooldown_count
  FROM (
    SELECT 1 FROM bids b
    JOIN   requests r ON r.id = b.request_id
    WHERE  b.provider_id = p_provider_id
      AND  r.client_id   = v_client_id
      AND  b.rejected_at > NOW() - INTERVAL '24 hours'
    UNION ALL
    SELECT 1 FROM contract_bids cb
    JOIN   recurring_contracts rc ON rc.id = cb.contract_id
    WHERE  cb.provider_id = p_provider_id
      AND  rc.client_id   = v_client_id
      AND  cb.rejected_at > NOW() - INTERVAL '24 hours'
  ) combined;

  IF v_cooldown_count > 0 THEN
    IF v_provider.subscription_tier <> 'premium' THEN
      UPDATE providers SET
        subscription_credits = subscription_credits + (p_credit_cost - v_from_bonus),
        bonus_credits        = bonus_credits        + v_from_bonus
      WHERE id = p_provider_id;
    END IF;
    RETURN jsonb_build_object('error', 'COOLDOWN_ACTIVE');
  END IF;

  -- ── Insert bid ────────────────────────────────────────────────
  INSERT INTO bids (request_id, provider_id, amount, currency, note, credit_cost, bonus_credits_used)
  VALUES (p_request_id, p_provider_id, p_amount, 'JOD', p_note, p_credit_cost, v_from_bonus)
  RETURNING id INTO v_bid_id;

  RETURN jsonb_build_object('bid_id', v_bid_id);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_bid_with_credits(UUID, UUID, NUMERIC, TEXT, INT) TO authenticated;

-- ── Recreate submit_contract_bid_with_credits without cap check ─
CREATE OR REPLACE FUNCTION submit_contract_bid_with_credits(
  p_contract_id     UUID,
  p_provider_id     UUID,
  p_price_per_visit NUMERIC,
  p_note            TEXT    DEFAULT NULL,
  p_credit_cost     INT     DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_provider        RECORD;
  v_client_id       UUID;
  v_cooldown_count  INT;
  v_bid_id          UUID;
  v_from_bonus      INT := 0;
  v_existing_bid_id UUID;
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
      'error',         'SUBSCRIPTION_EXPIRED',
      'bonus_credits', v_provider.bonus_credits
    );
  END IF;

  -- Verify contract exists and is open for bidding; get client_id
  SELECT client_id INTO v_client_id
  FROM   recurring_contracts
  WHERE  id = p_contract_id AND status = 'bidding';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'CONTRACT_NOT_FOUND');
  END IF;

  -- If provider already has a PENDING bid, update price/note without
  -- charging credits again (entry-fee model).
  SELECT id INTO v_existing_bid_id
  FROM   contract_bids
  WHERE  contract_id = p_contract_id
    AND  provider_id = p_provider_id
    AND  status      = 'pending';

  IF FOUND THEN
    UPDATE contract_bids
    SET price_per_visit = p_price_per_visit,
        note            = p_note
    WHERE id = v_existing_bid_id;
    RETURN jsonb_build_object('bid_id', v_existing_bid_id, 'updated', true);
  END IF;

  -- ── Credit deduction (non-premium only) ──────────────────────
  IF v_provider.subscription_tier <> 'premium' THEN
    IF v_provider.subscription_credits >= p_credit_cost THEN
      UPDATE providers
      SET subscription_credits = subscription_credits - p_credit_cost
      WHERE id = p_provider_id;
      v_from_bonus := 0;

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

  -- ── Cooldown: rejected bid on any request from same client in 24h ──
  SELECT COUNT(*) INTO v_cooldown_count
  FROM (
    SELECT 1 FROM bids b
    JOIN   requests r ON r.id = b.request_id
    WHERE  b.provider_id = p_provider_id
      AND  r.client_id   = v_client_id
      AND  b.rejected_at > NOW() - INTERVAL '24 hours'
    UNION ALL
    SELECT 1 FROM contract_bids cb
    JOIN   recurring_contracts rc ON rc.id = cb.contract_id
    WHERE  cb.provider_id = p_provider_id
      AND  rc.client_id   = v_client_id
      AND  cb.rejected_at > NOW() - INTERVAL '24 hours'
  ) combined;

  IF v_cooldown_count > 0 THEN
    IF v_provider.subscription_tier <> 'premium' THEN
      UPDATE providers SET
        subscription_credits = subscription_credits + (p_credit_cost - v_from_bonus),
        bonus_credits        = bonus_credits        + v_from_bonus
      WHERE id = p_provider_id;
    END IF;
    RETURN jsonb_build_object('error', 'COOLDOWN_ACTIVE');
  END IF;

  -- ── Insert contract bid ───────────────────────────────────────
  INSERT INTO contract_bids
    (contract_id, provider_id, price_per_visit, note, credit_cost, bonus_credits_used)
  VALUES
    (p_contract_id, p_provider_id, p_price_per_visit, p_note, p_credit_cost, v_from_bonus)
  RETURNING id INTO v_bid_id;

  RETURN jsonb_build_object('bid_id', v_bid_id);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_contract_bid_with_credits(UUID, UUID, NUMERIC, TEXT, INT) TO authenticated;
