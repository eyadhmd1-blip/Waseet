-- ============================================================
-- Migration 044: Profile Reports + User Suspension
--
-- 1. Adds `context` column to reports (request/chat/profile)
-- 2. Adds suspension fields to users (is_suspended, suspended_at, suspended_reason)
-- 3. Updates submit_report RPC to infer context + require description for profile reports
-- 4. Adds suspend_user / unsuspend_user RPCs (admin/service role)
-- 5. Adds user_report_counts view for admin dashboard
-- ============================================================

-- ── 1. context column on reports ──────────────────────────────

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS context TEXT NOT NULL DEFAULT 'request'
    CHECK (context IN ('request', 'chat', 'profile'));

-- ── 2. Suspension fields on users ─────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_suspended     BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_users_suspended ON users(is_suspended) WHERE is_suspended = true;

-- ── 3. Update submit_report — infer context, profile guard ────

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
  v_context     TEXT;
BEGIN
  v_reporter_id := auth.uid();

  IF v_reporter_id IS NULL THEN
    RETURN jsonb_build_object('error', 'UNAUTHENTICATED');
  END IF;

  IF v_reporter_id = p_reported_user_id THEN
    RETURN jsonb_build_object('error', 'CANNOT_REPORT_SELF');
  END IF;

  -- Infer context from which IDs are provided
  v_context := CASE
    WHEN p_request_id IS NOT NULL THEN 'request'
    WHEN p_job_id     IS NOT NULL THEN 'chat'
    ELSE 'profile'
  END;

  -- Profile reports require a description
  IF v_context = 'profile' AND (p_description IS NULL OR TRIM(p_description) = '') THEN
    RETURN jsonb_build_object('error', 'DESCRIPTION_REQUIRED');
  END IF;

  -- For profile reports: one report per reporter→reported pair (any type)
  IF v_context = 'profile' AND EXISTS (
    SELECT 1 FROM reports
    WHERE reporter_id      = v_reporter_id
      AND reported_user_id = p_reported_user_id
      AND request_id IS NULL
      AND job_id     IS NULL
  ) THEN
    RETURN jsonb_build_object('error', 'ALREADY_REPORTED');
  END IF;

  INSERT INTO reports (
    reporter_id, reported_user_id, report_type,
    description, request_id, job_id, context
  )
  VALUES (
    v_reporter_id,
    p_reported_user_id,
    p_report_type::report_type,
    p_description,
    p_request_id,
    p_job_id,
    v_context
  )
  ON CONFLICT ON CONSTRAINT uq_report_per_request DO NOTHING
  RETURNING id INTO v_report_id;

  IF v_report_id IS NULL THEN
    RETURN jsonb_build_object('error', 'ALREADY_REPORTED');
  END IF;

  INSERT INTO admin_alerts (alert_type, user_id, message, metadata)
  VALUES (
    'new_report',
    p_reported_user_id,
    'بلاغ جديد بحق مستخدم',
    jsonb_build_object(
      'report_id',   v_report_id,
      'report_type', p_report_type,
      'reporter_id', v_reporter_id,
      'context',     v_context,
      'request_id',  p_request_id
    )
  );

  RETURN jsonb_build_object('success', true, 'report_id', v_report_id);
END;
$$;

-- ── 4. Admin RPCs: suspend / unsuspend ────────────────────────
-- Called from the admin panel via service role only.

CREATE OR REPLACE FUNCTION suspend_user(
  p_user_id UUID,
  p_reason  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users
  SET is_suspended     = true,
      suspended_at     = NOW(),
      suspended_reason = p_reason
  WHERE id = p_user_id
    AND is_suspended = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND_OR_ALREADY_SUSPENDED');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION unsuspend_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users
  SET is_suspended     = false,
      suspended_at     = NULL,
      suspended_reason = NULL
  WHERE id = p_user_id
    AND is_suspended = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND_OR_NOT_SUSPENDED');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── 5. View: user_report_counts (admin dashboard) ─────────────

CREATE OR REPLACE VIEW user_report_counts AS
SELECT
  r.reported_user_id                                         AS user_id,
  u.full_name,
  u.phone,
  u.role,
  u.is_suspended,
  COUNT(*)                                                    AS total_reports,
  COUNT(*) FILTER (WHERE r.status = 'pending')               AS pending_reports,
  COUNT(*) FILTER (WHERE r.context = 'profile')              AS profile_reports,
  MAX(r.created_at)                                          AS last_report_at
FROM reports r
JOIN users u ON u.id = r.reported_user_id
GROUP BY r.reported_user_id, u.full_name, u.phone, u.role, u.is_suspended
ORDER BY total_reports DESC;
