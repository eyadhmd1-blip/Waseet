-- ============================================================
-- Migration 094: Carry-over remaining credits on subscription renewal
--
-- Previous behaviour: activate_provider_subscription always replaced
-- subscription_credits with the new plan's flat amount, discarding
-- any unused credits the provider had.
--
-- New behaviour:
--   - trial  (to)   → always fresh (10), no carry-over
--   - premium (to)  → 0 (unlimited tracked by tier, not credits)
--   - premium (from)→ carry = 0 (can't quantify "remaining" unlimited)
--   - all other     → new = LEAST(carry + plan_credits, plan_credits * 2)
--
-- This means a provider renewing Basic with 3 credits left gets 23,
-- capped at 40 (2 × 20) to prevent runaway accumulation.
-- ============================================================

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
  v_plan_credits  INT;
  v_carry         INT;
  v_new_credits   INT;
  v_trial_used    BOOLEAN;
  v_current_tier  TEXT;
  v_current_cred  INT;
  v_caller_id     UUID;
BEGIN
  -- Ownership / admin check (unchanged from migration 091)
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL
     AND v_caller_id <> p_provider_id
     AND NOT EXISTS (
       SELECT 1 FROM users WHERE id = v_caller_id AND is_admin = true
     )
  THEN
    RAISE EXCEPTION 'unauthorized: cannot activate subscription for another provider';
  END IF;

  -- Validate period
  IF p_period_months < 1 OR p_period_months > 12 THEN
    RAISE EXCEPTION 'invalid period_months: must be between 1 and 12';
  END IF;

  -- Trial re-use guard (unchanged)
  IF p_tier = 'trial' THEN
    SELECT trial_used INTO v_trial_used
    FROM   providers
    WHERE  id = p_provider_id;

    IF v_trial_used THEN
      RAISE EXCEPTION 'trial_already_used';
    END IF;
  END IF;

  -- Plan credits (flat amount for new plan)
  v_plan_credits := CASE p_tier
    WHEN 'trial'   THEN 10
    WHEN 'basic'   THEN 20
    WHEN 'pro'     THEN 50
    WHEN 'premium' THEN 0
    ELSE NULL
  END;

  IF v_plan_credits IS NULL THEN
    RAISE EXCEPTION 'invalid tier: %', p_tier;
  END IF;

  -- Read current state for carry-over calculation
  SELECT COALESCE(subscription_credits, 0),
         COALESCE(subscription_tier::TEXT, '')
  INTO   v_current_cred, v_current_tier
  FROM   providers
  WHERE  id = p_provider_id;

  -- Carry-over logic
  v_carry := CASE
    WHEN p_tier = 'trial'            THEN 0  -- trial always fresh
    WHEN p_tier = 'premium'          THEN 0  -- going unlimited, no carry needed
    WHEN v_current_tier = 'premium'  THEN 0  -- coming from unlimited, carry = 0
    WHEN v_current_tier = 'trial'    THEN 0  -- coming from trial (free), no carry
    ELSE v_current_cred                      -- carry remaining credits
  END;

  -- Final credits = carry + plan, capped at 2× plan (except trial/premium)
  v_new_credits := CASE
    WHEN p_tier IN ('trial', 'premium') THEN v_plan_credits
    ELSE LEAST(v_carry + v_plan_credits, v_plan_credits * 2)
  END;

  UPDATE providers SET
    is_subscribed        = true,
    subscription_tier    = p_tier::subscription_tier,
    subscription_ends    = NOW() + (p_period_months || ' months')::INTERVAL,
    subscription_credits = v_new_credits,
    trial_used           = CASE WHEN p_tier = 'trial' THEN true ELSE trial_used END,
    win_discount_pct     = 0,
    loyalty_discount     = 0,
    updated_at           = NOW()
  WHERE id = p_provider_id;
END;
$$;
