-- ============================================================
-- Migration 029 — OTP daily send cap
-- Adds a daily limit of 5 OTP sends per phone number to prevent
-- SMS cost attacks. The 60-second cooldown in send_otp still
-- applies; this is an additional hard daily ceiling.
-- ============================================================

CREATE OR REPLACE FUNCTION send_otp(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code        VARCHAR(6);
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

  -- Generate 6-digit code
  v_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

  -- Insert new OTP record
  INSERT INTO phone_otps (phone, code)
  VALUES (p_phone, v_code);

  RETURN jsonb_build_object('success', true, 'code', v_code, 'phone', p_phone);
END;
$$;
