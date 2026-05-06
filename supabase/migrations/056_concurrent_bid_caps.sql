-- ============================================================
-- Migration 056 — Concurrent Bid Caps + retract_bid RPC
--
-- Changes:
--   1. Fix refund_bids_on_cancel — was referencing dropped bid_credits column
--   2. Extend refund trigger to cover 'expired' requests (not just 'cancelled')
--   3. Update submit_bid_with_credits:
--        - Apply concurrent cap to ALL tiers (was Premium-only)
--        - Caps: trial=2, basic=4, pro=6, premium=8→12 dynamic
--        - Active count query now excludes closed requests
--        - Enhanced error JSONB with next-tier upgrade info
--   4. New RPC: retract_bid — provider withdraws a pending bid + credit refund
-- ============================================================

-- ── 1. Fix refund_bids_on_cancel (was using dropped bid_credits) ──
--    Also extends to cover 'expired' requests.

CREATE OR REPLACE FUNCTION refund_bids_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'expired')
     AND OLD.status NOT IN ('cancelled', 'expired') THEN

    -- Refund to subscription_credits if subscription still active,
    -- otherwise to bonus_credits (preserves frozen bonus mechanic).
    UPDATE providers p
    SET
      subscription_credits = CASE
        WHEN p.is_subscribed AND p.subscription_ends > NOW()
        THEN p.subscription_credits + b.credit_cost
        ELSE p.subscription_credits
      END,
      bonus_credits = CASE
        WHEN NOT (p.is_subscribed AND p.subscription_ends > NOW())
        THEN p.bonus_credits + b.credit_cost
        ELSE p.bonus_credits
      END
    FROM bids b
    WHERE b.request_id        = NEW.id
      AND b.status            = 'pending'
      AND b.provider_id       = p.id
      AND p.subscription_tier <> 'premium';

    -- Mark all pending bids on this request as rejected
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

-- ── 2. Update submit_bid_with_credits ─────────────────────────────
--    - Cap applied to all tiers
--    - Active count excludes closed requests
--    - Enhanced MAX_ACTIVE_BIDS error includes next-tier upgrade info

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

  -- Next-tier upgrade info (for MAX_ACTIVE_BIDS error message)
  v_next_tier       TEXT;
  v_next_tier_max   INT;
  v_next_tier_price NUMERIC;
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

  -- ── Concurrent bid cap (all tiers) ───────────────────────────
  v_max_bids := CASE v_provider.subscription_tier
    WHEN 'trial'   THEN 2
    WHEN 'basic'   THEN 4
    WHEN 'pro'     THEN 6
    WHEN 'premium' THEN LEAST(8 + FLOOR(v_provider.bonus_credits::NUMERIC / 5)::INT, 12)
    ELSE 2
  END;

  -- Count active bids only on still-open requests
  SELECT COUNT(*) INTO v_active_bids
  FROM   bids b
  JOIN   requests r ON r.id = b.request_id
  WHERE  b.provider_id = p_provider_id
    AND  b.status      = 'pending'
    AND  r.status NOT IN ('cancelled', 'completed', 'expired');

  IF v_active_bids >= v_max_bids THEN
    -- Build next-tier upgrade info
    v_next_tier       := CASE v_provider.subscription_tier
      WHEN 'trial' THEN 'basic'
      WHEN 'basic' THEN 'pro'
      WHEN 'pro'   THEN 'premium'
      ELSE NULL
    END;
    v_next_tier_max   := CASE v_next_tier
      WHEN 'basic'   THEN 4
      WHEN 'pro'     THEN 6
      WHEN 'premium' THEN 8
      ELSE NULL
    END;
    v_next_tier_price := CASE v_next_tier
      WHEN 'basic'   THEN 5
      WHEN 'pro'     THEN 12
      WHEN 'premium' THEN 22
      ELSE NULL
    END;

    RETURN jsonb_build_object(
      'error',             'MAX_ACTIVE_BIDS',
      'max',               v_max_bids,
      'active_count',      v_active_bids,
      'tier',              v_provider.subscription_tier,
      'next_tier',         v_next_tier,
      'next_tier_max',     v_next_tier_max,
      'next_tier_price',   v_next_tier_price
    );
  END IF;

  -- ── Credit deduction (non-premium only) ──────────────────────
  IF v_provider.subscription_tier <> 'premium' THEN
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

  -- ── Get client_id for cooldown check ─────────────────────────
  SELECT client_id INTO v_client_id
  FROM   requests
  WHERE  id = p_request_id;

  IF NOT FOUND THEN
    -- Refund credits if request not found
    IF v_provider.subscription_tier <> 'premium' THEN
      UPDATE providers SET
        subscription_credits = subscription_credits + p_credit_cost
      WHERE id = p_provider_id;
    END IF;
    RETURN jsonb_build_object('error', 'REQUEST_NOT_FOUND');
  END IF;

  -- ── Cooldown: rejected bid on any request from same client in 24h ──
  SELECT COUNT(*) INTO v_cooldown_count
  FROM   bids   b
  JOIN   requests r ON r.id = b.request_id
  WHERE  b.provider_id = p_provider_id
    AND  r.client_id   = v_client_id
    AND  b.rejected_at > NOW() - INTERVAL '24 hours';

  IF v_cooldown_count > 0 THEN
    -- Refund credits deducted before cooldown check
    IF v_provider.subscription_tier <> 'premium' THEN
      IF v_provider.subscription_credits >= p_credit_cost THEN
        UPDATE providers
        SET subscription_credits = subscription_credits + p_credit_cost
        WHERE id = p_provider_id;
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

  -- ── Insert bid ────────────────────────────────────────────────
  INSERT INTO bids (request_id, provider_id, amount, currency, note, credit_cost)
  VALUES (p_request_id, p_provider_id, p_amount, 'JOD', p_note, p_credit_cost)
  RETURNING id INTO v_bid_id;

  RETURN jsonb_build_object('bid_id', v_bid_id);
END;
$$;

-- ── 3. New RPC: retract_bid ────────────────────────────────────
--    Provider withdraws a pending bid and receives a full credit refund.
--    Only 'pending' bids can be retracted.

CREATE OR REPLACE FUNCTION retract_bid(
  p_bid_id      UUID,
  p_provider_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bid      RECORD;
  v_provider RECORD;
BEGIN
  -- Load bid
  SELECT id, status, credit_cost
  INTO   v_bid
  FROM   bids
  WHERE  id          = p_bid_id
    AND  provider_id = p_provider_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'BID_NOT_FOUND');
  END IF;

  IF v_bid.status <> 'pending' THEN
    RETURN jsonb_build_object('error', 'BID_NOT_PENDING');
  END IF;

  -- Load provider subscription state
  SELECT is_subscribed, subscription_ends, subscription_tier
  INTO   v_provider
  FROM   providers
  WHERE  id = p_provider_id;

  -- Mark bid as withdrawn
  UPDATE bids
  SET    status     = 'withdrawn',
         updated_at = NOW()
  WHERE  id = p_bid_id;

  -- Refund credits (non-premium only)
  IF v_provider.subscription_tier <> 'premium' THEN
    IF v_provider.is_subscribed AND v_provider.subscription_ends > NOW() THEN
      -- Active subscription: refund to subscription_credits
      UPDATE providers
      SET subscription_credits = subscription_credits + v_bid.credit_cost
      WHERE id = p_provider_id;
    ELSE
      -- Expired subscription: refund to bonus_credits (stays frozen)
      UPDATE providers
      SET bonus_credits = bonus_credits + v_bid.credit_cost
      WHERE id = p_provider_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success',          true,
    'credits_refunded', CASE WHEN v_provider.subscription_tier <> 'premium' THEN v_bid.credit_cost ELSE 0 END
  );
END;
$$;

-- ── 4. Index: speed active-bid-count query ────────────────────
CREATE INDEX IF NOT EXISTS idx_bids_provider_pending
  ON bids(provider_id, status)
  WHERE status = 'pending';
