-- ============================================================
-- Migration 077: Security Fixes
--
-- BUG-002: activate_provider_subscription — add caller auth check
-- BUG-005: confirm-job brute-force — add confirm_attempts + lockout
-- BUG-006/007/013: submit_bid_with_credits — reorder ops + FOR UPDATE
-- BUG-021: submit_bid_with_credits — validate bid amount range
-- BUG-022: bids — track bonus_credits_used per bid
-- BUG-030: activate_provider_subscription — DB-level trial re-use guard
-- BUG-003: subscriptions — UNIQUE constraint on paddle_txn_id
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- BUG-022: Add bonus_credits_used column to bids
-- ─────────────────────────────────────────────────────────────

ALTER TABLE bids
  ADD COLUMN IF NOT EXISTS bonus_credits_used INT NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- BUG-005: Add confirm_attempts column to jobs
-- ─────────────────────────────────────────────────────────────

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS confirm_attempts INT NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- BUG-003: UNIQUE constraint on paddle_txn_id (idempotency)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS paddle_txn_id TEXT;

-- Nullify duplicate paddle_txn_id values (keep the latest, clear the rest)
-- so the unique index can be created safely even if dev data has collisions.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY paddle_txn_id ORDER BY created_at DESC) AS rn
  FROM subscriptions
  WHERE paddle_txn_id IS NOT NULL
)
UPDATE subscriptions
SET paddle_txn_id = NULL
FROM ranked
WHERE subscriptions.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_paddle_txn_id
  ON subscriptions (paddle_txn_id)
  WHERE paddle_txn_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- BUG-006/007/013/021: Rewrite submit_bid_with_credits
--
-- Key changes vs migration 055:
--   1. FOR UPDATE lock on providers row (BUG-013: race condition)
--   2. Request existence check BEFORE credit deduction (BUG-006)
--   3. Cooldown check BEFORE credit deduction (BUG-007: no refund needed)
--   4. Bid amount validation: must be > 0 and <= 10000 (BUG-021)
--   5. Track bonus_credits_used in bid INSERT (BUG-022)
--   6. No refund code needed (ordering makes it impossible to owe one)
-- ─────────────────────────────────────────────────────────────

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
  v_provider        RECORD;
  v_client_id       UUID;
  v_request_status  TEXT;
  v_active_bids     INT;
  v_max_bids        INT;
  v_cooldown_count  INT;
  v_bid_id          UUID;
  v_from_bonus      INT := 0;
BEGIN
  -- ── 1. Input validation ──────────────────────────────────────
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 10000 THEN
    RETURN jsonb_build_object('error', 'INVALID_AMOUNT');
  END IF;

  IF p_credit_cost IS NULL OR p_credit_cost < 1 THEN
    RETURN jsonb_build_object('error', 'INVALID_CREDIT_COST');
  END IF;

  -- ── 2. Load provider with FOR UPDATE lock (prevents double-spend) ──
  SELECT is_subscribed, subscription_tier, subscription_ends,
         subscription_credits, bonus_credits
  INTO   v_provider
  FROM   providers
  WHERE  id = p_provider_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'PROVIDER_NOT_FOUND');
  END IF;

  -- ── 3. Check subscription active ────────────────────────────
  IF NOT v_provider.is_subscribed OR v_provider.subscription_ends < NOW() THEN
    RETURN jsonb_build_object(
      'error',         'SUBSCRIPTION_EXPIRED',
      'bonus_credits', v_provider.bonus_credits
    );
  END IF;

  -- ── 4. Check credits availability (before any DB writes) ────
  IF v_provider.subscription_tier <> 'premium' THEN
    IF (v_provider.subscription_credits + v_provider.bonus_credits) < p_credit_cost THEN
      RETURN jsonb_build_object('error', 'NO_CREDITS');
    END IF;
  END IF;

  -- ── 5. Verify request exists and is open (before deducting credits) ──
  SELECT client_id, status
  INTO   v_client_id, v_request_status
  FROM   requests
  WHERE  id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'REQUEST_NOT_FOUND');
  END IF;

  IF v_request_status NOT IN ('open', 'pending') THEN
    RETURN jsonb_build_object('error', 'REQUEST_NOT_OPEN');
  END IF;

  -- ── 6. Cooldown check (before deducting credits) ─────────────
  SELECT COUNT(*) INTO v_cooldown_count
  FROM   bids   b
  JOIN   requests r ON r.id = b.request_id
  WHERE  b.provider_id = p_provider_id
    AND  r.client_id   = v_client_id
    AND  b.rejected_at > NOW() - INTERVAL '24 hours';

  IF v_cooldown_count > 0 THEN
    RETURN jsonb_build_object('error', 'COOLDOWN_ACTIVE');
  END IF;

  -- ── 7. Premium: check concurrent bid cap ─────────────────────
  IF v_provider.subscription_tier = 'premium' THEN
    v_max_bids := LEAST(5 + FLOOR(v_provider.bonus_credits::NUMERIC / 5)::INT, 8);

    SELECT COUNT(*) INTO v_active_bids
    FROM   bids
    WHERE  provider_id = p_provider_id
      AND  status      = 'pending';

    IF v_active_bids >= v_max_bids THEN
      RETURN jsonb_build_object('error', 'MAX_ACTIVE_BIDS', 'max', v_max_bids);
    END IF;
  END IF;

  -- ── 8. Deduct credits — subscription wallet first, then bonus ──
  IF v_provider.subscription_tier <> 'premium' THEN
    IF v_provider.subscription_credits >= p_credit_cost THEN
      UPDATE providers
      SET subscription_credits = subscription_credits - p_credit_cost
      WHERE id = p_provider_id;
      v_from_bonus := 0;
    ELSE
      v_from_bonus := p_credit_cost - v_provider.subscription_credits;
      UPDATE providers
      SET subscription_credits = 0,
          bonus_credits        = bonus_credits - v_from_bonus
      WHERE id = p_provider_id;
    END IF;
  END IF;

  -- ── 9. Insert bid with bonus tracking ────────────────────────
  INSERT INTO bids (
    request_id, provider_id, amount, currency, note,
    credit_cost, bonus_credits_used
  )
  VALUES (
    p_request_id, p_provider_id, p_amount, 'JOD', p_note,
    p_credit_cost, v_from_bonus
  )
  RETURNING id INTO v_bid_id;

  RETURN jsonb_build_object('bid_id', v_bid_id);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- BUG-002 + BUG-030: Rewrite activate_provider_subscription
--
-- Key changes:
--   1. Caller auth check: if auth.uid() is not null, it must equal
--      p_provider_id (blocks providers from activating other accounts).
--      Service-role callers (paddle-webhook, admin) have auth.uid() = null.
--   2. DB-level trial guard: if trial already used, raise exception
--      rather than silently doing nothing (BUG-030).
-- ─────────────────────────────────────────────────────────────

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
  -- Ownership check: user JWTs must match the target provider.
  -- Service-role callers (paddle-webhook, admin RPC) have no auth.uid().
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL AND v_caller_id <> p_provider_id THEN
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
    WHEN 'premium' THEN 0   -- unlimited sentinel; subscription_credits unused
    ELSE NULL
  END;

  IF v_credits IS NULL THEN
    RAISE EXCEPTION 'invalid tier: %', p_tier;
  END IF;

  UPDATE providers SET
    is_subscribed        = true,
    subscription_tier    = p_tier::subscription_tier,
    subscription_ends    = NOW() + (p_period_months || ' months')::INTERVAL,
    subscription_credits = v_credits,   -- REPLACE each cycle
    trial_used           = CASE WHEN p_tier = 'trial' THEN true ELSE trial_used END,
    win_discount_pct     = 0,
    loyalty_discount     = 0,
    updated_at           = NOW()
  WHERE id = p_provider_id;
END;
$$;
