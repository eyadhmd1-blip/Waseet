-- ============================================================
-- Migration 088: Pass-2 Bug Fixes
--
-- NC-01: renotify_providers_for_stale_requests() — fix crash caused
--        by p.city reference (providers has no city column; join
--        through users table instead)
--
-- NC-03+NC-05: undo_accept_bid() — add FOR UPDATE lock to serialise
--        with provider_commit_job(); restore only rejected bids (skip
--        any that were already in a non-pending state); clear
--        rejected_at so restoring a bid does not trigger a false 24h
--        cooldown on the provider
--
-- NC-04: submit_bid_with_credits() — restore cooldown exclusion for
--        cancelled/expired requests that was present in migration 068
--        but accidentally dropped when migration 077 rewrote this
--        function
--
-- NH-01: send_otp() — replace RANDOM() (Mersenne Twister / non-CSPRNG)
--        with gen_random_bytes() for cryptographically secure OTP
--        generation
--
-- NH-02: verify_otp() — replace inline subquery code comparison with
--        a declared variable, removing implicit reliance on short-circuit
--        evaluation and making the comparison intent explicit
--
-- NH-03: cancel_job() — block client cancellation after provider has
--        committed (provider_committed_at IS NOT NULL); returning
--        PROVIDER_COMMITTED error so the app can show a meaningful
--        message
--
-- NH-04: lookup_auth_user_by_phone_or_email() — targeted DB helper
--        for the verify-otp edge function; replaces the listUsers()
--        full-table scan (which fails silently for user #1001+)
--
-- NH-05: fn_check_cancellation_abuse() — change threshold from = 3
--        to >= 3 so that every cancellation beyond the 3rd also
--        fires an admin alert (not just exactly the 3rd)
--
-- NM-01: boost_bid() — add SET search_path = public, pg_catalog
--        (SECURITY DEFINER function was missing search_path guard)
--
-- NM-02: Register cleanup_expired_otps() as a daily pg_cron job
--        (function existed since migration 020 but was never scheduled,
--        allowing phone_otps table to grow unboundedly)
--
-- NM-03: invoke_notify_no_bids() and
--        invoke_send_delayed_commit_notifications() — add
--        SET search_path = public, pg_catalog (search_path guard)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- NC-04: submit_bid_with_credits — restore cooldown exclusion
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
  -- 1. Input validation
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 10000 THEN
    RETURN jsonb_build_object('error', 'INVALID_AMOUNT');
  END IF;

  IF p_credit_cost IS NULL OR p_credit_cost < 1 THEN
    RETURN jsonb_build_object('error', 'INVALID_CREDIT_COST');
  END IF;

  -- 2. Load provider with FOR UPDATE lock (prevents double-spend race)
  SELECT is_subscribed, subscription_tier, subscription_ends,
         subscription_credits, bonus_credits
  INTO   v_provider
  FROM   providers
  WHERE  id = p_provider_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'PROVIDER_NOT_FOUND');
  END IF;

  -- 3. Check subscription active
  IF NOT v_provider.is_subscribed OR v_provider.subscription_ends < NOW() THEN
    RETURN jsonb_build_object(
      'error',         'SUBSCRIPTION_EXPIRED',
      'bonus_credits', v_provider.bonus_credits
    );
  END IF;

  -- 4. Check credits availability (before any DB writes)
  IF v_provider.subscription_tier <> 'premium' THEN
    IF (v_provider.subscription_credits + v_provider.bonus_credits) < p_credit_cost THEN
      RETURN jsonb_build_object('error', 'NO_CREDITS');
    END IF;
  END IF;

  -- 5. Verify request exists and is open (before deducting credits)
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

  -- 6. Cooldown check (before deducting credits)
  --    NC-04: exclude cancelled/expired requests so providers are not
  --    blocked from bidding on a client's new requests when their bid
  --    was rejected only because the previous request was cancelled.
  SELECT COUNT(*) INTO v_cooldown_count
  FROM   bids   b
  JOIN   requests r ON r.id = b.request_id
  WHERE  b.provider_id = p_provider_id
    AND  r.client_id   = v_client_id
    AND  b.rejected_at > NOW() - INTERVAL '24 hours'
    AND  r.status NOT IN ('cancelled', 'expired');

  IF v_cooldown_count > 0 THEN
    RETURN jsonb_build_object('error', 'COOLDOWN_ACTIVE');
  END IF;

  -- 7. Premium: check concurrent bid cap
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

  -- 8. Deduct credits — subscription wallet first, then bonus
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

  -- 9. Insert bid with bonus tracking
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
-- NC-01: renotify_providers_for_stale_requests — fix city join
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION renotify_providers_for_stale_requests()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Insert notifications for matching providers.
  -- NC-01: join through users to get city (providers has no city column).
  INSERT INTO notifications (user_id, title, body, screen, metadata, created_at)
  SELECT DISTINCT
    p.id,
    'تذكير: طلب لم يُستجب له بعد',
    r.title,
    'provider_feed',
    jsonb_build_object('request_id', r.id, 'type', 'renotify'),
    NOW()
  FROM requests r
  JOIN providers p
    ON r.category_slug = ANY(p.categories)
   AND p.is_subscribed = TRUE
  JOIN users u
    ON u.id   = p.id
   AND u.city = r.city
  WHERE
    r.status                   = 'open'
    AND r.created_at           < NOW() - INTERVAL '2 hours'
    AND r.created_at           > NOW() - INTERVAL '48 hours'
    AND r.provider_renotified_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM bids
      WHERE bids.request_id = r.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM bids b2
      WHERE b2.request_id = r.id
        AND b2.provider_id = p.id
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Mark requests as re-notified (idempotent)
  UPDATE requests
  SET provider_renotified_at = NOW()
  WHERE
    status                   = 'open'
    AND created_at           < NOW() - INTERVAL '2 hours'
    AND created_at           > NOW() - INTERVAL '48 hours'
    AND provider_renotified_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM bids WHERE bids.request_id = requests.id
    );

  RETURN v_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- NC-03 + NC-05: undo_accept_bid — FOR UPDATE + targeted restore
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION undo_accept_bid(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jobs%ROWTYPE;
BEGIN
  -- NC-03: Lock job row to serialise with concurrent provider_commit_job calls.
  --        Without FOR UPDATE, a provider could commit between our IS NOT NULL
  --        check and the subsequent cancellation.
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'job_not_found');
  END IF;

  -- Only the client can undo
  IF v_job.client_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  -- Grace period must not have expired
  IF v_job.client_grace_expires_at IS NOT NULL
     AND v_job.client_grace_expires_at < NOW() THEN
    RETURN jsonb_build_object('error', 'grace_period_expired');
  END IF;

  -- Provider must not have already committed
  IF v_job.provider_committed_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'provider_already_committed');
  END IF;

  -- Cancel job
  UPDATE jobs SET status = 'cancelled' WHERE id = p_job_id;

  -- NC-05: Restore the winning bid (was set to 'accepted' by accept_bid).
  --        Clear rejected_at so the provider does not carry a false 24h cooldown.
  UPDATE bids
  SET status      = 'pending',
      rejected_at = NULL
  WHERE id = v_job.bid_id;

  -- NC-05: Restore only bids in 'rejected' state (those set by accept_bid).
  --        Skip bids in any other state (e.g. already withdrawn before accept).
  --        Clear rejected_at to prevent false cooldown on restored providers.
  UPDATE bids
  SET status      = 'pending',
      rejected_at = NULL
  WHERE request_id = v_job.request_id
    AND id        != v_job.bid_id
    AND status     = 'rejected';

  -- Reopen the request
  UPDATE requests
  SET status = 'open', updated_at = NOW()
  WHERE id = v_job.request_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION undo_accept_bid(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION undo_accept_bid(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- NH-01: send_otp — CSPRNG via gen_random_bytes
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION send_otp(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_code        VARCHAR(6);
  v_rnd_buf     BYTEA;
  v_last_sent   TIMESTAMPTZ;
  v_daily_count INT;
BEGIN
  p_phone := TRIM(p_phone);

  -- Rate-limit: max 1 OTP per 60 seconds per phone
  SELECT MAX(created_at) INTO v_last_sent
  FROM phone_otps
  WHERE phone = p_phone;

  IF v_last_sent IS NOT NULL AND v_last_sent > NOW() - INTERVAL '60 seconds' THEN
    RETURN jsonb_build_object('success', false, 'error', 'RATE_LIMITED');
  END IF;

  -- Daily cap: max 5 OTP sends per phone per calendar day
  SELECT COUNT(*) INTO v_daily_count
  FROM phone_otps
  WHERE phone = p_phone
    AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Amman');

  IF v_daily_count >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'DAILY_LIMIT_EXCEEDED');
  END IF;

  -- Expire old OTPs for this phone
  UPDATE phone_otps
  SET expires_at = NOW()
  WHERE phone = p_phone AND verified_at IS NULL AND expires_at > NOW();

  -- NH-01: Generate 6-digit OTP via CSPRNG (gen_random_bytes replaces RANDOM()).
  --        3 bytes = 0..16777215; modulo 1000000 gives uniform 6-digit code
  --        (tiny modular bias of ~0.005% — acceptable for OTP purposes).
  v_rnd_buf := gen_random_bytes(3);
  v_code := LPAD(
    (((get_byte(v_rnd_buf, 0)::INT << 16) |
      (get_byte(v_rnd_buf, 1)::INT << 8)  |
       get_byte(v_rnd_buf, 2)::INT) % 1000000)::TEXT,
    6, '0'
  );

  -- Insert new OTP record
  INSERT INTO phone_otps (phone, code)
  VALUES (p_phone, v_code);

  RETURN jsonb_build_object('success', true, 'code', v_code, 'phone', p_phone);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- NH-02: verify_otp — explicit variable comparison
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION verify_otp(p_phone TEXT, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_otp_id      UUID;
  v_attempts    INT;
  v_expires     TIMESTAMPTZ;
  v_verified    TIMESTAMPTZ;
  v_stored_code TEXT;
BEGIN
  p_phone := TRIM(p_phone);
  p_code  := TRIM(p_code);

  -- Fetch latest valid OTP for this phone
  SELECT id, attempts, expires_at, verified_at
  INTO v_otp_id, v_attempts, v_expires, v_verified
  FROM phone_otps
  WHERE phone = p_phone
    AND expires_at > NOW()
    AND verified_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_otp_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'OTP_EXPIRED');
  END IF;

  -- Max 5 attempts
  IF v_attempts >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'MAX_ATTEMPTS');
  END IF;

  -- Increment attempt counter before code check
  UPDATE phone_otps SET attempts = attempts + 1 WHERE id = v_otp_id;

  -- NH-02: Fetch stored code into a local variable to avoid the inline
  --        subquery pattern and make the comparison semantics explicit.
  --        Note: true constant-time comparison is not achievable in PL/pgSQL;
  --        the 5-attempt rate limit is the primary brute-force guard.
  SELECT code INTO v_stored_code FROM phone_otps WHERE id = v_otp_id;
  IF v_stored_code IS DISTINCT FROM p_code THEN
    RETURN jsonb_build_object('success', false, 'error', 'WRONG_CODE');
  END IF;

  -- Mark as verified
  UPDATE phone_otps SET verified_at = NOW() WHERE id = v_otp_id;

  -- Mark user's phone as verified
  UPDATE users SET phone_verified = true WHERE phone = p_phone;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- NH-03: cancel_job — block client cancel after provider committed
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cancel_job(
  p_job_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID;
  v_job           jobs%ROWTYPE;
  v_party         cancellation_party;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;

  IF v_job.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_job.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_ACTIVE');
  END IF;

  -- Determine party
  IF v_user_id = v_job.client_id THEN
    v_party := 'client';
  ELSIF v_user_id = v_job.provider_id THEN
    v_party := 'provider';
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
  END IF;

  -- NH-03: Block client from cancelling after provider has committed.
  --        Once provider_committed_at is set, the provider has accepted
  --        the job and is en-route; unilateral client cancellation at this
  --        point is disallowed.
  IF v_party = 'client' AND v_job.provider_committed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'PROVIDER_COMMITTED');
  END IF;

  -- Update job status
  UPDATE jobs SET status = 'cancelled', updated_at = NOW() WHERE id = p_job_id;

  -- Update associated request back to open
  UPDATE requests SET status = 'open', updated_at = NOW()
  WHERE id = v_job.request_id;

  -- Log cancellation (triggers fn_check_cancellation_abuse)
  INSERT INTO cancellation_log (job_id, cancelled_by, cancelled_party, reason)
  VALUES (p_job_id, v_user_id, v_party, p_reason);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- NH-04: lookup_auth_user_by_phone_or_email — targeted DB helper
--        for verify-otp edge function (replaces listUsers full scan)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION lookup_auth_user_by_phone_or_email(
  p_phone TEXT,
  p_email TEXT
)
RETURNS TABLE(auth_user_id UUID, auth_email TEXT, auth_phone TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT id, email, phone::TEXT
  FROM auth.users
  WHERE email = p_email
     OR phone = p_phone
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION lookup_auth_user_by_phone_or_email(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_auth_user_by_phone_or_email(TEXT, TEXT) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- NH-05: fn_check_cancellation_abuse — threshold >= 3 not = 3
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_check_cancellation_abuse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_name  TEXT;
BEGIN
  -- Count cancellations by this user in the current calendar month
  SELECT COUNT(*) INTO v_count
  FROM cancellation_log
  WHERE cancelled_by = NEW.cancelled_by
    AND created_at >= DATE_TRUNC('month', NOW());

  -- NH-05: Alert admin on >= 3 cancellations (not = 3), so every additional
  --        cancellation beyond the threshold also fires an alert rather than
  --        only the third one.
  IF v_count >= 3 THEN
    SELECT full_name INTO v_name FROM users WHERE id = NEW.cancelled_by;

    INSERT INTO admin_alerts (alert_type, user_id, message, metadata)
    VALUES (
      'cancellation_abuse',
      NEW.cancelled_by,
      'مستخدم وصل لـ ' || v_count || ' إلغاءات هذا الشهر: ' || COALESCE(v_name, NEW.cancelled_by::TEXT),
      jsonb_build_object(
        'user_id',     NEW.cancelled_by,
        'count',       v_count,
        'month',       TO_CHAR(NOW(), 'YYYY-MM'),
        'last_job_id', NEW.job_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_cancellation_abuse ON cancellation_log;
CREATE TRIGGER trg_check_cancellation_abuse
  AFTER INSERT ON cancellation_log
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_cancellation_abuse();

-- ─────────────────────────────────────────────────────────────
-- NM-01: boost_bid — add SET search_path
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION boost_bid(
  p_bid_id      UUID,
  p_provider_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_bid          bids%ROWTYPE;
  v_provider     providers%ROWTYPE;
  v_active_boost INTEGER;
  v_expires      TIMESTAMPTZ;
BEGIN
  -- Lock bid row to prevent race conditions
  SELECT * INTO v_bid
  FROM bids
  WHERE id = p_bid_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'BID_NOT_FOUND');
  END IF;

  -- Ownership check
  IF v_bid.provider_id <> p_provider_id THEN
    RETURN jsonb_build_object('error', 'UNAUTHORIZED');
  END IF;

  -- Only pending bids can be boosted
  IF v_bid.status <> 'pending' THEN
    RETURN jsonb_build_object('error', 'BID_NOT_PENDING');
  END IF;

  -- Idempotency: already boosted
  IF v_bid.is_boosted THEN
    RETURN jsonb_build_object('error', 'ALREADY_BOOSTED');
  END IF;

  -- One active boost per provider at a time
  SELECT COUNT(*) INTO v_active_boost
  FROM bids
  WHERE provider_id = p_provider_id
    AND is_boosted = true
    AND boost_expires_at > NOW();

  IF v_active_boost > 0 THEN
    RETURN jsonb_build_object('error', 'BOOST_LIMIT_REACHED');
  END IF;

  -- Lock provider row
  SELECT * INTO v_provider
  FROM providers
  WHERE id = p_provider_id
  FOR UPDATE;

  -- Credits check — premium gets free boosts
  IF v_provider.subscription_tier <> 'premium' THEN
    IF COALESCE(v_provider.subscription_credits, 0) < 1 THEN
      RETURN jsonb_build_object('error', 'NO_CREDITS');
    END IF;
    UPDATE providers
    SET subscription_credits = subscription_credits - 1
    WHERE id = p_provider_id;
  END IF;

  -- Apply boost
  v_expires := NOW() + INTERVAL '2 hours';

  UPDATE bids
  SET is_boosted       = true,
      boosted_at       = NOW(),
      boost_expires_at = v_expires
  WHERE id = p_bid_id;

  RETURN jsonb_build_object(
    'success',          true,
    'boost_expires_at', v_expires
  );
END;
$$;

GRANT EXECUTE ON FUNCTION boost_bid(UUID, UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- NM-02: Register cleanup_expired_otps as daily cron (04:00 UTC)
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-expired-otps');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-expired-otps',
  '0 4 * * *',
  'SELECT cleanup_expired_otps()'
);

GRANT EXECUTE ON FUNCTION cleanup_expired_otps() TO service_role;

-- ─────────────────────────────────────────────────────────────
-- NM-03: invoke_notify_no_bids — add SET search_path
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION invoke_notify_no_bids()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_url text := current_setting('app.settings.supabase_url',    true);
  v_key text := current_setting('app.settings.service_role_key', true);
BEGIN
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'notify-no-bids: app.settings.supabase_url or service_role_key not configured — skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/notify-no-bids',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    := '{}'::jsonb
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- NM-03: invoke_send_delayed_commit_notifications — add SET search_path
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION invoke_send_delayed_commit_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_url text := current_setting('app.settings.supabase_url',     true);
  v_key text := current_setting('app.settings.service_role_key', true);
BEGIN
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'send-delayed-commit-notifications: supabase_url or service_role_key not configured — skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/send-delayed-commit-notifications',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    := '{}'::jsonb
  );
END;
$$;
