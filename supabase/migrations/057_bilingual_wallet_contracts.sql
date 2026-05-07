-- ============================================================
-- Migration 057 — Bilingual Notifications + Wallet-Accurate
--                Refunds + Contract Bid Credits +
--                In-App Notification Triggers
--
-- Changes:
--   1.  Add users.lang — language preference for bilingual notifications
--   2.  Add bids.bonus_credits_used — exact wallet tracking per bid
--   3.  Add contract_bids.bonus_credits_used + rejected_at + credit_cost
--   4.  Update submit_bid_with_credits — record bonus_credits_used on INSERT;
--       extend cooldown check to cover contract_bids; combined active-bid count
--   5.  New RPC submit_contract_bid_with_credits — full credit logic (3 credits
--       default), same cap + cooldown rules as regular bids
--   6.  Update accept_contract_bid — set rejected_at on losing contract bids
--   7.  Update refund_bids_on_cancel — wallet-accurate refund using bonus_credits_used
--   8.  Update retract_bid — wallet-accurate refund using bonus_credits_used
--   9.  New trigger refund_contract_bids_on_cancel — credits back on contract cancel
--  10.  In-app notification triggers: bid_accepted, job_rated, contract_bid_accepted
--  11.  Indexes + grants
-- ============================================================

-- ── 1. users.lang ─────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'ar'
    CHECK (lang IN ('ar', 'en'));

-- ── 2. bids.bonus_credits_used ────────────────────────────────
ALTER TABLE bids
  ADD COLUMN IF NOT EXISTS bonus_credits_used INT NOT NULL DEFAULT 0;

-- ── 3. contract_bids extra columns ───────────────────────────
ALTER TABLE contract_bids
  ADD COLUMN IF NOT EXISTS credit_cost        INT          NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS bonus_credits_used INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejected_at        TIMESTAMPTZ;

-- ── 4. Update submit_bid_with_credits ─────────────────────────
--    - Records bonus_credits_used on INSERT
--    - Cooldown check now covers both bids AND contract_bids
--    - Active-bid count is combined across both tables
--    - Wallet-accurate credit refund on REQUEST_NOT_FOUND / COOLDOWN_ACTIVE

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
  v_from_bonus     INT := 0;

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

  -- ── Concurrent bid cap ────────────────────────────────────────
  v_max_bids := CASE v_provider.subscription_tier
    WHEN 'trial'   THEN 2
    WHEN 'basic'   THEN 4
    WHEN 'pro'     THEN 6
    WHEN 'premium' THEN LEAST(8 + FLOOR(v_provider.bonus_credits::NUMERIC / 5)::INT, 12)
    ELSE 2
  END;

  -- Combined active bid count across regular bids AND contract bids
  SELECT
    (SELECT COUNT(*) FROM bids b
     JOIN   requests r ON r.id = b.request_id
     WHERE  b.provider_id = p_provider_id
       AND  b.status      = 'pending'
       AND  r.status NOT IN ('cancelled', 'completed', 'expired'))
    +
    (SELECT COUNT(*) FROM contract_bids cb
     JOIN   recurring_contracts rc ON rc.id = cb.contract_id
     WHERE  cb.provider_id = p_provider_id
       AND  cb.status      = 'pending'
       AND  rc.status NOT IN ('cancelled', 'completed'))
  INTO v_active_bids;

  IF v_active_bids >= v_max_bids THEN
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
      'error',           'MAX_ACTIVE_BIDS',
      'max',             v_max_bids,
      'active_count',    v_active_bids,
      'tier',            v_provider.subscription_tier,
      'next_tier',       v_next_tier,
      'next_tier_max',   v_next_tier_max,
      'next_tier_price', v_next_tier_price
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
    -- Wallet-accurate refund before returning error
    IF v_provider.subscription_tier <> 'premium' THEN
      UPDATE providers SET
        subscription_credits = subscription_credits + (p_credit_cost - v_from_bonus),
        bonus_credits        = bonus_credits        + v_from_bonus
      WHERE id = p_provider_id;
    END IF;
    RETURN jsonb_build_object('error', 'REQUEST_NOT_FOUND');
  END IF;

  -- ── Cooldown: rejected bid on any request from same client in 24h ──
  -- Covers both regular bids and contract bids.
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

-- ── 5. New RPC: submit_contract_bid_with_credits ──────────────
--    p_credit_cost defaults to 3 (contract bid type cost).
--    If provider already has a PENDING bid on this contract, updates
--    price/note without charging credits again (same entry-fee model).

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
  v_active_bids     INT;
  v_max_bids        INT;
  v_cooldown_count  INT;
  v_bid_id          UUID;
  v_from_bonus      INT := 0;
  v_existing_bid_id UUID;

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

  -- Verify contract exists and is open for bidding; get client_id
  SELECT client_id INTO v_client_id
  FROM   recurring_contracts
  WHERE  id = p_contract_id AND status = 'bidding';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'CONTRACT_NOT_FOUND');
  END IF;

  -- If provider already has a PENDING bid, update price/note without
  -- charging credits again (they already paid the entry fee).
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

  -- ── Concurrent bid cap ────────────────────────────────────────
  v_max_bids := CASE v_provider.subscription_tier
    WHEN 'trial'   THEN 2
    WHEN 'basic'   THEN 4
    WHEN 'pro'     THEN 6
    WHEN 'premium' THEN LEAST(8 + FLOOR(v_provider.bonus_credits::NUMERIC / 5)::INT, 12)
    ELSE 2
  END;

  SELECT
    (SELECT COUNT(*) FROM bids b
     JOIN   requests r ON r.id = b.request_id
     WHERE  b.provider_id = p_provider_id
       AND  b.status      = 'pending'
       AND  r.status NOT IN ('cancelled', 'completed', 'expired'))
    +
    (SELECT COUNT(*) FROM contract_bids cb
     JOIN   recurring_contracts rc ON rc.id = cb.contract_id
     WHERE  cb.provider_id = p_provider_id
       AND  cb.status      = 'pending'
       AND  rc.status NOT IN ('cancelled', 'completed'))
  INTO v_active_bids;

  IF v_active_bids >= v_max_bids THEN
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
      'error',           'MAX_ACTIVE_BIDS',
      'max',             v_max_bids,
      'active_count',    v_active_bids,
      'tier',            v_provider.subscription_tier,
      'next_tier',       v_next_tier,
      'next_tier_max',   v_next_tier_max,
      'next_tier_price', v_next_tier_price
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

-- ── 6. Update accept_contract_bid — set rejected_at ───────────
CREATE OR REPLACE FUNCTION accept_contract_bid(p_bid_id UUID, p_client_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_bid      contract_bids;
  v_contract recurring_contracts;
  v_starts   TIMESTAMPTZ := NOW();
  v_ends     TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_bid FROM contract_bids WHERE id = p_bid_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'bid_not_found'; END IF;

  SELECT * INTO v_contract FROM recurring_contracts WHERE id = v_bid.contract_id;
  IF v_contract.client_id <> p_client_id THEN RAISE EXCEPTION 'not_owner'; END IF;
  IF v_contract.status <> 'bidding' THEN RAISE EXCEPTION 'contract_not_bidding'; END IF;

  v_ends := v_starts + (v_contract.duration_months || ' months')::INTERVAL;

  -- Accept the winning bid
  UPDATE contract_bids SET status = 'accepted' WHERE id = p_bid_id;

  -- Reject losing bids and set rejected_at for cooldown tracking
  UPDATE contract_bids
  SET  status      = 'rejected',
       rejected_at = NOW()
  WHERE contract_id = v_bid.contract_id
    AND id          <> p_bid_id
    AND status      = 'pending';

  -- Activate the contract
  UPDATE recurring_contracts SET
    provider_id     = v_bid.provider_id,
    price_per_visit = v_bid.price_per_visit,
    currency        = v_bid.currency,
    status          = 'active',
    starts_at       = v_starts,
    ends_at         = v_ends,
    updated_at      = NOW()
  WHERE id = v_contract.id;

  PERFORM schedule_upcoming_visits(
    v_contract.id, v_starts, v_contract.frequency, v_contract.preferred_day, 3
  );
END;
$$;

-- ── 7. Update refund_bids_on_cancel — wallet-accurate ─────────
--    Uses bonus_credits_used from each bid so refunds go to the
--    exact wallet that was spent, regardless of current sub status.

CREATE OR REPLACE FUNCTION refund_bids_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'expired')
     AND OLD.status NOT IN ('cancelled', 'expired') THEN

    -- Wallet-accurate refund: bonus portion → bonus_credits,
    -- subscription portion → subscription_credits.
    UPDATE providers p
    SET
      bonus_credits        = p.bonus_credits        + b.bonus_credits_used,
      subscription_credits = p.subscription_credits + (b.credit_cost - b.bonus_credits_used)
    FROM bids b
    WHERE b.request_id        = NEW.id
      AND b.status            = 'pending'
      AND b.provider_id       = p.id
      AND p.subscription_tier <> 'premium';

    -- Mark all pending bids rejected (sets rejected_at for cooldown)
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

-- ── 8. Update retract_bid — wallet-accurate refund ────────────

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
  SELECT id, status, credit_cost, bonus_credits_used
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

  SELECT subscription_tier INTO v_provider
  FROM   providers
  WHERE  id = p_provider_id;

  -- Mark bid as withdrawn
  UPDATE bids
  SET  status     = 'withdrawn',
       updated_at = NOW()
  WHERE id = p_bid_id;

  -- Wallet-accurate refund (non-premium only)
  IF v_provider.subscription_tier <> 'premium' THEN
    UPDATE providers
    SET
      bonus_credits        = bonus_credits        + v_bid.bonus_credits_used,
      subscription_credits = subscription_credits + (v_bid.credit_cost - v_bid.bonus_credits_used)
    WHERE id = p_provider_id;
  END IF;

  RETURN jsonb_build_object(
    'success',          true,
    'credits_refunded', CASE WHEN v_provider.subscription_tier <> 'premium'
                             THEN v_bid.credit_cost ELSE 0 END
  );
END;
$$;

-- ── 9. Trigger: refund contract bids when contract cancelled ───

CREATE OR REPLACE FUNCTION refund_contract_bids_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN

    -- Wallet-accurate refund for all pending contract bids
    UPDATE providers p
    SET
      bonus_credits        = p.bonus_credits        + cb.bonus_credits_used,
      subscription_credits = p.subscription_credits + (cb.credit_cost - cb.bonus_credits_used)
    FROM contract_bids cb
    WHERE cb.contract_id    = NEW.id
      AND cb.status         = 'pending'
      AND cb.provider_id    = p.id
      AND p.subscription_tier <> 'premium';

    -- Mark pending contract bids as rejected + set rejected_at for cooldown
    UPDATE contract_bids
    SET  status      = 'rejected',
         rejected_at = NOW()
    WHERE contract_id = NEW.id
      AND status      = 'pending';

  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refund_contract_bids_on_cancel ON recurring_contracts;
CREATE TRIGGER trg_refund_contract_bids_on_cancel
  AFTER UPDATE ON recurring_contracts
  FOR EACH ROW
  EXECUTE FUNCTION refund_contract_bids_on_cancel();

-- ── 10. In-app notification triggers ─────────────────────────

-- 10a. Regular bid accepted → notify provider inbox
CREATE OR REPLACE FUNCTION notify_bid_accepted_inbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    SELECT title INTO v_title FROM requests WHERE id = NEW.request_id;

    INSERT INTO notifications (user_id, title, body, type, screen, metadata)
    VALUES (
      NEW.provider_id,
      'تم قبول عرضك ✅',
      'تهانينا! قبل العميل عرضك على: ' || COALESCE(v_title, 'الطلب'),
      'bid_accepted',
      '/(provider)/jobs',
      jsonb_build_object('request_id', NEW.request_id, 'bid_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_bid_accepted ON bids;
CREATE TRIGGER trg_notify_bid_accepted
  AFTER UPDATE ON bids
  FOR EACH ROW
  EXECUTE FUNCTION notify_bid_accepted_inbox();

-- 10b. Job rated by client → notify provider inbox
CREATE OR REPLACE FUNCTION notify_job_rated_inbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
BEGIN
  IF NEW.client_rating IS NOT NULL
     AND OLD.client_rating IS DISTINCT FROM NEW.client_rating THEN

    SELECT r.title INTO v_title
    FROM   requests r
    WHERE  r.id = NEW.request_id;

    INSERT INTO notifications (user_id, title, body, type, screen, metadata)
    VALUES (
      NEW.provider_id,
      'قيّم العميل خدمتك ⭐',
      'حصلت على ' || NEW.client_rating || ' نجوم على: ' || COALESCE(v_title, 'الطلب'),
      'job_rated',
      '/(provider)/jobs',
      jsonb_build_object('job_id', NEW.id, 'rating', NEW.client_rating)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_job_rated ON jobs;
CREATE TRIGGER trg_notify_job_rated
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION notify_job_rated_inbox();

-- 10c. Contract bid accepted → notify provider inbox
CREATE OR REPLACE FUNCTION notify_contract_bid_accepted_inbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    SELECT title INTO v_title FROM recurring_contracts WHERE id = NEW.contract_id;

    INSERT INTO notifications (user_id, title, body, type, screen, metadata)
    VALUES (
      NEW.provider_id,
      'تم قبول عرضك على العقد 🤝',
      'تهانينا! قبل العميل عرضك على: ' || COALESCE(v_title, 'العقد'),
      'contract_bid_accepted',
      '/(provider)/profile',
      jsonb_build_object('contract_id', NEW.contract_id, 'bid_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_contract_bid_accepted ON contract_bids;
CREATE TRIGGER trg_notify_contract_bid_accepted
  AFTER UPDATE ON contract_bids
  FOR EACH ROW
  EXECUTE FUNCTION notify_contract_bid_accepted_inbox();

-- ── 11. Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_lang
  ON users(lang);

CREATE INDEX IF NOT EXISTS idx_bids_rejected_at
  ON bids(provider_id, rejected_at)
  WHERE rejected_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contract_bids_rejected_at
  ON contract_bids(provider_id, rejected_at)
  WHERE rejected_at IS NOT NULL;

-- ── 12. Grants ────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION submit_bid_with_credits(UUID, UUID, NUMERIC, TEXT, INT)              TO authenticated;
GRANT EXECUTE ON FUNCTION submit_contract_bid_with_credits(UUID, UUID, NUMERIC, TEXT, INT)     TO authenticated;
GRANT EXECUTE ON FUNCTION retract_bid(UUID, UUID)                                              TO authenticated;
GRANT EXECUTE ON FUNCTION accept_contract_bid(UUID, UUID)                                      TO authenticated;

-- ── 13. Fix public_provider_profiles — expose is_suspended ────
--    The admin public profile page uses this to suppress suspended
--    providers before rendering their landing page.

CREATE OR REPLACE VIEW public_provider_profiles
  WITH (security_invoker = true)
AS
SELECT
  pr.id,
  pr.username,
  pr.score,
  pr.reputation_tier,
  pr.lifetime_jobs,
  pr.badge_verified,
  pr.share_count,
  pr.profile_views,
  pr.categories,
  pr.bio,
  u.full_name,
  u.city,
  u.is_suspended
FROM providers pr
JOIN users u ON u.id = pr.id
WHERE pr.show_public = TRUE;
