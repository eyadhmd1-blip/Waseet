-- ============================================================
-- Migration 055: Two-Wallet Credit System
--
-- Splits bid_credits into two separate columns:
--   subscription_credits  — awarded on subscription/renewal, REPLACED each cycle
--   bonus_credits         — earned via achievements, accumulates, FROZEN when subscription lapses
--
-- Premium providers:
--   • No subscription_credits (unlimited bids)
--   • bonus_credits expand active bid cap: 5 + FLOOR(bonus/5), max 8
--
-- Spending order: subscription_credits first, then bonus_credits
-- Bonus credits are frozen when subscription_ends < NOW()
-- ============================================================

-- ── 1. Add new columns ────────────────────────────────────────

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS subscription_credits INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_credits        INT NOT NULL DEFAULT 0;

-- ── 2. Migrate existing bid_credits → subscription_credits ───

UPDATE providers
SET subscription_credits = bid_credits
WHERE bid_credits > 0;

-- ── 3. Drop old column ────────────────────────────────────────

ALTER TABLE providers DROP COLUMN IF EXISTS bid_credits;

-- ── 4. Update activate_provider_subscription ─────────────────
-- subscription_credits = REPLACED each renewal (not added)
-- bonus_credits        = untouched (carries over)

CREATE OR REPLACE FUNCTION activate_provider_subscription(
  p_provider_id   UUID,
  p_tier          TEXT,
  p_period_months INT DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_credits INT;
BEGIN
  v_credits := CASE p_tier
    WHEN 'trial'   THEN 10
    WHEN 'basic'   THEN 20
    WHEN 'pro'     THEN 50
    WHEN 'premium' THEN 0   -- unlimited sentinel, subscription_credits unused
    ELSE 20
  END;

  UPDATE providers SET
    is_subscribed        = true,
    subscription_tier    = p_tier::subscription_tier,
    subscription_ends    = NOW() + (p_period_months || ' months')::INTERVAL,
    subscription_credits = v_credits,        -- REPLACE (fresh allocation each cycle)
    -- bonus_credits intentionally NOT touched (carries over between renewals)
    trial_used           = CASE WHEN p_tier = 'trial' THEN true ELSE trial_used END,
    win_discount_pct     = 0,
    loyalty_discount     = 0,
    updated_at           = NOW()
  WHERE id = p_provider_id;
END;
$$;

-- ── 5. Update award triggers → write to bonus_credits ─────────

-- 5a. Job completion → +2 bonus credits
CREATE OR REPLACE FUNCTION award_bid_credits_on_job_done()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.confirmed_by_client = true AND OLD.confirmed_by_client = false THEN
    UPDATE providers
    SET bonus_credits = bonus_credits + 2
    WHERE id = NEW.provider_id
      AND subscription_tier != 'premium';
  END IF;
  RETURN NEW;
END;
$$;

-- 5b. Reputation tier upgrade → bonus credits (BEFORE trigger — modifies NEW directly)
CREATE OR REPLACE FUNCTION award_tier_upgrade_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_bonus INT := 0;
BEGIN
  IF NEW.reputation_tier = OLD.reputation_tier THEN
    RETURN NEW;
  END IF;

  v_bonus := CASE NEW.reputation_tier
    WHEN 'rising'  THEN 5
    WHEN 'trusted' THEN 10
    WHEN 'expert'  THEN 15
    WHEN 'elite'   THEN 25
    ELSE 0
  END;

  IF v_bonus > 0 AND NEW.subscription_tier != 'premium' THEN
    NEW.bonus_credits := NEW.bonus_credits + v_bonus;
  END IF;

  RETURN NEW;
END;
$$;

-- 5c. Loyalty milestones → bonus credits (BEFORE trigger)
CREATE OR REPLACE FUNCTION award_milestone_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_bonus INT := 0;
BEGIN
  IF NEW.lifetime_jobs = OLD.lifetime_jobs THEN
    RETURN NEW;
  END IF;

  IF OLD.lifetime_jobs < 10 AND NEW.lifetime_jobs >= 10 THEN
    v_bonus := v_bonus + 15;
  END IF;

  IF OLD.lifetime_jobs < 25 AND NEW.lifetime_jobs >= 25 THEN
    v_bonus := v_bonus + 30;
  END IF;

  IF v_bonus > 0 AND NEW.subscription_tier != 'premium' THEN
    NEW.bonus_credits := NEW.bonus_credits + v_bonus;
  END IF;

  RETURN NEW;
END;
$$;

-- 5d. 5-star rating → +1 bonus credit
CREATE OR REPLACE FUNCTION award_five_star_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.provider_rating = 5 AND (OLD.provider_rating IS NULL OR OLD.provider_rating < 5) THEN
    UPDATE providers
    SET bonus_credits = bonus_credits + 1
    WHERE id = NEW.provider_id
      AND subscription_tier != 'premium';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 6. Update submit_bid_with_credits — two-wallet logic ──────

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

  -- Check subscription active (covers expired subscriptions too)
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
    RETURN jsonb_build_object('error', 'REQUEST_NOT_FOUND');
  END IF;

  -- Cooldown: rejected bid on any request from same client in last 24h
  SELECT COUNT(*) INTO v_cooldown_count
  FROM   bids   b
  JOIN   requests r ON r.id = b.request_id
  WHERE  b.provider_id = p_provider_id
    AND  r.client_id   = v_client_id
    AND  b.rejected_at > NOW() - INTERVAL '24 hours';

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

-- ── 7. Index for expiry queries ───────────────────────────────

CREATE INDEX IF NOT EXISTS idx_providers_sub_ends
  ON providers(subscription_ends)
  WHERE is_subscribed = true;
