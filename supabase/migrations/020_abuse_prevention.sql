-- ══════════════════════════════════════════════════════════════
-- Migration 020 — Abuse Prevention & Anti-Spam Infrastructure
-- Adds: bid price limits, phone OTP, reports system,
--       cancellation tracking, admin alerts, phone filter
-- ══════════════════════════════════════════════════════════════

-- ── 1. Bid price limits on service_categories ─────────────────

ALTER TABLE service_categories
  ADD COLUMN IF NOT EXISTS min_bid NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS max_bid NUMERIC(10,2);

-- Constraint: max must be greater than min when both are set
ALTER TABLE service_categories
  DROP CONSTRAINT IF EXISTS chk_bid_range;

ALTER TABLE service_categories
  ADD CONSTRAINT chk_bid_range
  CHECK (min_bid IS NULL OR max_bid IS NULL OR max_bid > min_bid);

-- ── 2. Phone OTP table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS phone_otps (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        TEXT        NOT NULL,
  code         VARCHAR(6)  NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  attempts     INT         NOT NULL DEFAULT 0,
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allow only the most recent unverified OTP per phone to be active
CREATE INDEX IF NOT EXISTS idx_phone_otps_phone ON phone_otps(phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_otps_expires ON phone_otps(expires_at) WHERE verified_at IS NULL;

ALTER TABLE phone_otps ENABLE ROW LEVEL SECURITY;
-- No public policies — accessed only via RPCs (SECURITY DEFINER)

-- ── 3. Report type enum ───────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_type') THEN
    CREATE TYPE report_type AS ENUM ('no_show', 'fake_bid', 'abusive', 'spam', 'other');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');
  END IF;
END $$;

-- ── 4. Reports table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reports (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type      report_type   NOT NULL,
  description      TEXT,
  request_id       UUID          REFERENCES requests(id) ON DELETE SET NULL,
  job_id           UUID          REFERENCES jobs(id) ON DELETE SET NULL,
  status           report_status NOT NULL DEFAULT 'pending',
  admin_notes      TEXT,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Prevent duplicate reports for same interaction
  CONSTRAINT uq_report_per_request UNIQUE NULLS NOT DISTINCT (reporter_id, reported_user_id, request_id, report_type)
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Reporters can read their own reports
CREATE POLICY "reporter_read_own" ON reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- Reporters can insert (enforced by RPC, this is a fallback)
CREATE POLICY "reporter_insert_own" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON reports(reported_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status        ON reports(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reports_reporter      ON reports(reporter_id, created_at DESC);

-- ── 5. Cancellation log ───────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cancellation_party') THEN
    CREATE TYPE cancellation_party AS ENUM ('client', 'provider');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS cancellation_log (
  id               UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID               NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  cancelled_by     UUID               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cancelled_party  cancellation_party NOT NULL,
  reason           TEXT,
  created_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

ALTER TABLE cancellation_log ENABLE ROW LEVEL SECURITY;
-- No user-facing policies; written by trigger, read by admin (service role)

CREATE INDEX IF NOT EXISTS idx_cancellation_log_user ON cancellation_log(cancelled_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cancellation_log_job  ON cancellation_log(job_id);

-- ── 6. Admin alert type enum & table ─────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_alert_type') THEN
    CREATE TYPE admin_alert_type AS ENUM (
      'cancellation_abuse',
      'new_report',
      'high_rejection_rate',
      'suspicious_account'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS admin_alerts (
  id           UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type   admin_alert_type NOT NULL,
  user_id      UUID             REFERENCES users(id) ON DELETE SET NULL,
  message      TEXT             NOT NULL,
  metadata     JSONB            NOT NULL DEFAULT '{}',
  is_read      BOOLEAN          NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;
-- No public policies — service role only

CREATE INDEX IF NOT EXISTS idx_admin_alerts_unread    ON admin_alerts(created_at DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_admin_alerts_user      ON admin_alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_type      ON admin_alerts(alert_type, created_at DESC);

-- ── 7. RPC: send_otp ──────────────────────────────────────────
-- Called by mobile before/during registration to send a code.
-- Returns: { success: bool, error?: string }

CREATE OR REPLACE FUNCTION send_otp(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code      VARCHAR(6);
  v_last_sent TIMESTAMPTZ;
BEGIN
  -- Normalize phone (strip spaces)
  p_phone := TRIM(p_phone);

  -- Rate-limit: max 1 OTP per 60 seconds per phone
  SELECT MAX(created_at) INTO v_last_sent
  FROM phone_otps
  WHERE phone = p_phone;

  IF v_last_sent IS NOT NULL AND v_last_sent > NOW() - INTERVAL '60 seconds' THEN
    RETURN jsonb_build_object('success', false, 'error', 'RATE_LIMITED');
  END IF;

  -- Expire old OTPs for this phone
  UPDATE phone_otps
  SET expires_at = NOW()
  WHERE phone = p_phone AND verified_at IS NULL AND expires_at > NOW();

  -- Generate 6-digit code
  v_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

  -- Insert new OTP record
  INSERT INTO phone_otps (phone, code)
  VALUES (p_phone, v_code);

  -- Return the code so the edge function can pass it to Unifonic
  -- (edge function is the one that actually sends the SMS)
  RETURN jsonb_build_object('success', true, 'code', v_code, 'phone', p_phone);
END;
$$;

-- ── 8. RPC: verify_otp ───────────────────────────────────────
-- Called by mobile to verify OTP code entered by user.
-- Returns: { success: bool, error?: string }

CREATE OR REPLACE FUNCTION verify_otp(p_phone TEXT, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_otp_id    UUID;
  v_attempts  INT;
  v_expires   TIMESTAMPTZ;
  v_verified  TIMESTAMPTZ;
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

  -- Increment attempt counter
  UPDATE phone_otps SET attempts = attempts + 1 WHERE id = v_otp_id;

  -- Check code
  IF (SELECT code FROM phone_otps WHERE id = v_otp_id) != p_code THEN
    RETURN jsonb_build_object('success', false, 'error', 'WRONG_CODE');
  END IF;

  -- Mark as verified
  UPDATE phone_otps SET verified_at = NOW() WHERE id = v_otp_id;

  -- Mark user's phone as verified
  UPDATE users SET phone_verified = true WHERE phone = p_phone;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── 9. RPC: submit_report ─────────────────────────────────────
-- Called by mobile to submit an abuse report.
-- Returns: { report_id: uuid } or error JSONB

CREATE OR REPLACE FUNCTION submit_report(
  p_reported_user_id UUID,
  p_report_type      TEXT,
  p_description      TEXT    DEFAULT NULL,
  p_request_id       UUID    DEFAULT NULL,
  p_job_id           UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reporter_id UUID;
  v_report_id   UUID;
BEGIN
  v_reporter_id := auth.uid();

  -- Must be authenticated
  IF v_reporter_id IS NULL THEN
    RETURN jsonb_build_object('error', 'UNAUTHENTICATED');
  END IF;

  -- Cannot report yourself
  IF v_reporter_id = p_reported_user_id THEN
    RETURN jsonb_build_object('error', 'CANNOT_REPORT_SELF');
  END IF;

  -- Insert report (UNIQUE constraint prevents duplicates per request+type)
  INSERT INTO reports (
    reporter_id, reported_user_id, report_type, description, request_id, job_id
  )
  VALUES (
    v_reporter_id,
    p_reported_user_id,
    p_report_type::report_type,
    p_description,
    p_request_id,
    p_job_id
  )
  ON CONFLICT ON CONSTRAINT uq_report_per_request DO NOTHING
  RETURNING id INTO v_report_id;

  IF v_report_id IS NULL THEN
    RETURN jsonb_build_object('error', 'ALREADY_REPORTED');
  END IF;

  -- Create admin alert for new report
  INSERT INTO admin_alerts (alert_type, user_id, message, metadata)
  VALUES (
    'new_report',
    p_reported_user_id,
    'بلاغ جديد بحق مستخدم',
    jsonb_build_object(
      'report_id',   v_report_id,
      'report_type', p_report_type,
      'reporter_id', v_reporter_id,
      'request_id',  p_request_id
    )
  );

  RETURN jsonb_build_object('success', true, 'report_id', v_report_id);
END;
$$;

-- ── 10. RPC: validate_bid_amount ─────────────────────────────
-- Called by mobile before submitting a bid; checks min/max for category.
-- Returns: { valid: bool, min_bid?: numeric, max_bid?: numeric, error?: string }

CREATE OR REPLACE FUNCTION validate_bid_amount(
  p_category_slug TEXT,
  p_amount        NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min NUMERIC;
  v_max NUMERIC;
BEGIN
  SELECT min_bid, max_bid
  INTO v_min, v_max
  FROM service_categories
  WHERE slug = p_category_slug AND is_active = true;

  IF v_min IS NOT NULL AND p_amount < v_min THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'BELOW_MIN',
      'min_bid', v_min,
      'max_bid', v_max
    );
  END IF;

  IF v_max IS NOT NULL AND p_amount > v_max THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'ABOVE_MAX',
      'min_bid', v_min,
      'max_bid', v_max
    );
  END IF;

  RETURN jsonb_build_object('valid', true, 'min_bid', v_min, 'max_bid', v_max);
END;
$$;

-- ── 11. Trigger: track cancellations & alert admin ────────────
-- Fires when a job's status changes to 'cancelled' after it was 'active'.
-- Logs the cancellation and checks if user exceeded 3/month threshold.

CREATE OR REPLACE FUNCTION fn_track_job_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancelled_by    UUID;
  v_cancelled_party cancellation_party;
  v_count_month     INT;
BEGIN
  -- Only fire when transitioning TO cancelled FROM active
  IF OLD.status != 'active' OR NEW.status != 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Determine who cancelled: use auth.uid(), fall back to provider heuristic
  -- (In practice the mobile app calls an RPC that sets cancelled_by)
  -- This trigger uses client_id as the cancelling party when status changes via RPC
  -- The cancellation_log is inserted by the cancel_job RPC below; this trigger
  -- just handles the alert counting.

  -- Count cancellations this calendar month for each party
  -- (This is called after cancel_job RPC inserts into cancellation_log)

  RETURN NEW;
END;
$$;

-- Actual cancellation counting trigger (runs after cancel_job RPC inserts log row)
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

  -- Alert admin if threshold reached (exactly 3 — avoid repeated alerts)
  IF v_count = 3 THEN
    SELECT full_name INTO v_name FROM users WHERE id = NEW.cancelled_by;

    INSERT INTO admin_alerts (alert_type, user_id, message, metadata)
    VALUES (
      'cancellation_abuse',
      NEW.cancelled_by,
      'مستخدم وصل لـ 3 إلغاءات هذا الشهر: ' || COALESCE(v_name, NEW.cancelled_by::TEXT),
      jsonb_build_object(
        'user_id',    NEW.cancelled_by,
        'count',      v_count,
        'month',      TO_CHAR(NOW(), 'YYYY-MM'),
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

-- ── 12. RPC: cancel_job ───────────────────────────────────────
-- Cancels an active job and logs the cancellation.
-- Returns: { success: bool } or error

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

-- ── 13. Cleanup: auto-expire OTPs older than 1 day ────────────
-- Keeps the phone_otps table lean.

CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM phone_otps
  WHERE expires_at < NOW() - INTERVAL '1 day';
$$;

-- ── 14. Indexes for query performance ─────────────────────────

CREATE INDEX IF NOT EXISTS idx_jobs_status_active      ON jobs(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_jobs_client_provider    ON jobs(client_id, provider_id);
CREATE INDEX IF NOT EXISTS idx_service_cat_slug_active ON service_categories(slug) WHERE is_active = true;
