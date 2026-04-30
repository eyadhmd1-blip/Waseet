-- ============================================================
-- Migration 048 — Notification Inbox
--
-- Adds server-side helpers for the unified notification inbox:
--   1. mark_all_notifications_read  — bulk-marks all unread rows
--      for a user as read in one UPDATE (used by "mark all" btn).
--   2. mark_notification_read       — marks a single notification
--      read by id (used on tap inside the inbox).
--
-- The notifications table and its indexes were created in 045.
-- RLS policy "notifications_own" (also from 045) already allows
-- authenticated users to SELECT / UPDATE their own rows, so no
-- new policies are needed here.
-- ============================================================

-- ── 1. mark_all_notifications_read ───────────────────────────

CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE notifications
  SET    is_read = true
  WHERE  user_id = p_user_id
    AND  is_read = false;
$$;

GRANT EXECUTE ON FUNCTION mark_all_notifications_read(UUID) TO authenticated;

-- ── 2. mark_notification_read ─────────────────────────────────

CREATE OR REPLACE FUNCTION mark_notification_read(p_notif_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE notifications
  SET    is_read = true
  WHERE  id      = p_notif_id
    AND  user_id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION mark_notification_read(UUID, UUID) TO authenticated;
