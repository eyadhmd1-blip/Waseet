-- ============================================================
-- WASEET — Bid Credits Subscription System
-- Migration 019 | April 2026
-- Replaces max_services gating with bid credits per tier.
-- New tiers: trial (once, 10 credits free) | basic (20/5JOD)
--            pro (50/12JOD) | premium (unlimited/22JOD, max 5 active)
-- ============================================================

-- 1a. Extend subscription_tier enum
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'trial';

-- ============================================================
-- 1b. New columns on providers
-- ============================================================

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS bid_credits        INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_used         BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bid_rejection_rate NUMERIC(4,3) NOT NULL DEFAULT 0.000,
  ADD COLUMN IF NOT EXISTS win_discount_pct   INT          NOT NULL DEFAULT 0;

-- ============================================================
-- 1c. New columns on bids
-- ============================================================

ALTER TABLE bids
  ADD COLUMN IF NOT EXISTS credit_cost INT        NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- ============================================================
-- 1d. RPC: submit_bid_with_credits
--     Atomic bid submission with credit deduction + anti-spam
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

  -- Cooldown: any bid from this provider on any request of same client
  -- that was rejected in the last 24 hours
  SELECT COUNT(*) INTO v_cooldown_count
  FROM   bids   b
  JOIN   requests r ON r.id = b.request_id
  WHERE  b.provider_id = p_provider_id
    AND  r.client_id   = v_client_id
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

  -- Insert bid
  INSERT INTO bids (request_id, provider_id, amount, currency, note, credit_cost)
  VALUES (p_request_id, p_provider_id, p_amount, 'JOD', p_note, p_credit_cost)
  RETURNING id INTO v_bid_id;

  RETURN jsonb_build_object('bid_id', v_bid_id);
END;
$$;

-- ============================================================
-- 1e. Function: update rejected_at + bid_rejection_rate
--     Called as a trigger after bids status changes to 'rejected'
-- ============================================================

CREATE OR REPLACE FUNCTION track_bid_rejection()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total    INT;
  v_rejected INT;
  v_rate     NUMERIC(4,3);
BEGIN
  -- Only act when status just became 'rejected'
  IF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN

    -- Stamp rejected_at
    UPDATE bids
    SET    rejected_at = NOW()
    WHERE  id = NEW.id
      AND  rejected_at IS NULL;

    -- Recalculate rejection rate over last 30 days
    SELECT
      COUNT(*) FILTER (WHERE status IN ('accepted','rejected')),
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

    UPDATE providers
    SET    bid_rejection_rate = v_rate
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

-- ============================================================
-- 1f. Function: award_win_renewal_discount
--     +3% per completed job, max 15%, called from update_provider_score
-- ============================================================

CREATE OR REPLACE FUNCTION award_win_renewal_discount(p_provider_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE providers
  SET    win_discount_pct = LEAST(win_discount_pct + 3, 15)
  WHERE  id = p_provider_id;
END;
$$;

-- Hook into existing trigger that fires on job completion
-- We look for update_provider_score and extend it, or add a new trigger.
-- Safe approach: add a dedicated trigger on jobs table for status = 'completed'

CREATE OR REPLACE FUNCTION trg_fn_award_win_discount()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    PERFORM award_win_renewal_discount(NEW.provider_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_win_discount ON jobs;
CREATE TRIGGER trg_award_win_discount
  AFTER UPDATE OF status ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_award_win_discount();

-- ============================================================
-- 1g. RPC: activate_provider_subscription
--     Called by paddle-webhook after successful payment.
--     Sets credits, flags trial_used, resets discounts.
-- ============================================================

CREATE OR REPLACE FUNCTION activate_provider_subscription(
  p_provider_id   UUID,
  p_tier          TEXT,     -- 'trial'|'basic'|'pro'|'premium'
  p_period_months INT DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits INT;
BEGIN
  -- Map tier → credits (premium uses 0 as sentinel = unlimited)
  CASE p_tier
    WHEN 'trial'   THEN v_credits := 10;
    WHEN 'basic'   THEN v_credits := 20;
    WHEN 'pro'     THEN v_credits := 50;
    WHEN 'premium' THEN v_credits := 0;   -- unlimited
    ELSE v_credits := 20;
  END CASE;

  UPDATE providers SET
    is_subscribed     = true,
    subscription_tier = p_tier::subscription_tier,
    subscription_ends = NOW() + (p_period_months || ' months')::INTERVAL,
    bid_credits       = v_credits,
    win_discount_pct  = 0,     -- consumed at this renewal
    loyalty_discount  = 0,     -- consumed at this renewal
    trial_used        = CASE WHEN p_tier = 'trial' THEN true ELSE trial_used END,
    updated_at        = NOW()
  WHERE id = p_provider_id;
END;
$$;

-- ============================================================
-- 1h. Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_bids_provider_rejected_at
  ON bids (provider_id, rejected_at)
  WHERE rejected_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bids_provider_status_pending
  ON bids (provider_id, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_providers_bid_credits
  ON providers (bid_credits);
