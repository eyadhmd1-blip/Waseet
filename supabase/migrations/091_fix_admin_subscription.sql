-- ============================================================
-- Migration 091: Fix Admin Subscription Activation (BUG-AC02)
--
-- 1. Fix activate_provider_subscription ownership check:
--    Admins (is_admin=true) can activate subscriptions for
--    any provider — only regular users are blocked from
--    activating on behalf of other accounts.
--
-- 2. New admin_grant_trial RPC:
--    Allows admin to grant a trial subscription without a
--    support ticket (trial is free so no ticket is created).
-- ============================================================

-- ── 1. Fix activate_provider_subscription ────────────────────
--    Only change: add "AND NOT is_admin" to ownership check.
--    All other logic is identical to migration 077.

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
  v_credits     INT;
  v_trial_used  BOOLEAN;
  v_caller_id   UUID;
BEGIN
  -- Ownership check: user JWTs must match the target provider,
  -- unless the caller is an admin or service-role (auth.uid = null).
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

  -- DB-level trial re-use guard (BUG-030)
  IF p_tier = 'trial' THEN
    SELECT trial_used INTO v_trial_used
    FROM   providers
    WHERE  id = p_provider_id;

    IF v_trial_used THEN
      RAISE EXCEPTION 'trial_already_used';
    END IF;
  END IF;

  v_credits := CASE p_tier
    WHEN 'trial'   THEN 10
    WHEN 'basic'   THEN 20
    WHEN 'pro'     THEN 50
    WHEN 'premium' THEN 0
    ELSE NULL
  END;

  IF v_credits IS NULL THEN
    RAISE EXCEPTION 'invalid tier: %', p_tier;
  END IF;

  UPDATE providers SET
    is_subscribed        = true,
    subscription_tier    = p_tier::subscription_tier,
    subscription_ends    = NOW() + (p_period_months || ' months')::INTERVAL,
    subscription_credits = v_credits,
    trial_used           = CASE WHEN p_tier = 'trial' THEN true ELSE trial_used END,
    win_discount_pct     = 0,
    loyalty_discount     = 0,
    updated_at           = NOW()
  WHERE id = p_provider_id;
END;
$$;

-- ── 2. admin_grant_trial — no ticket required ─────────────────

CREATE OR REPLACE FUNCTION admin_grant_trial(p_provider_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  PERFORM activate_provider_subscription(
    p_provider_id   := p_provider_id,
    p_tier          := 'trial',
    p_period_months := 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_grant_trial(UUID) TO authenticated;
