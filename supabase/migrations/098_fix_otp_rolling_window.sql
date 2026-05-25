-- ============================================================
-- Migration 098 — Fix OTP daily cap to rolling 24-hour window
--
-- Previous: date_trunc('day', NOW() AT TIME ZONE 'Asia/Amman')
--   → resets at midnight Amman time, allowing 10 sends in 3 minutes
--     (5 before midnight + 5 after midnight)
--
-- Fixed: NOW() - INTERVAL '24 hours'
--   → true rolling window regardless of time of day
-- ============================================================

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

  -- Rolling 24-hour cap: max 5 OTP sends per phone in any 24-hour period
  SELECT COUNT(*) INTO v_daily_count
  FROM phone_otps
  WHERE phone = p_phone
    AND created_at >= NOW() - INTERVAL '24 hours';

  IF v_daily_count >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'DAILY_LIMIT_EXCEEDED');
  END IF;

  -- Expire old OTPs for this phone
  UPDATE phone_otps
  SET expires_at = NOW()
  WHERE phone = p_phone AND verified_at IS NULL AND expires_at > NOW();

  -- Generate 6-digit OTP via CSPRNG (gen_random_bytes replaces RANDOM()).
  -- 3 bytes = 0..16777215; modulo 1000000 gives uniform 6-digit code.
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
