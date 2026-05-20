-- ============================================================
-- Migration 096: Fix user_report_counts view security
--
-- Issue: Supabase security advisor flagged user_report_counts
-- as SECURITY DEFINER (runs with owner's permissions, bypassing RLS).
--
-- Fix: Recreate view WITH (security_invoker = on) so it runs
-- with the querying user's permissions and respects RLS.
-- Admin portal uses service_role which bypasses RLS anyway,
-- so behaviour is unchanged for the admin dashboard.
-- ============================================================

CREATE OR REPLACE VIEW public.user_report_counts
WITH (security_invoker = on)
AS
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
