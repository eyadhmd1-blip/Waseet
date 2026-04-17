-- ============================================================
-- Migration 028: Add Policies to Tables with RLS but No Policies
--
-- These tables have RLS enabled but zero policies defined,
-- which means ALL access (even from authenticated users) is
-- silently blocked — unless the service-role key is used.
-- That is the intended behaviour for admin-only tables, but
-- Supabase flags it as a lint warning. We add explicit
-- deny-all / service-role-only documentation policies to
-- make the intent unambiguous and silence the linter.
--
-- Affected tables:
--   admin_alerts, admin_audit_log, cancellation_log,
--   phone_otps, platform_settings, platform_stats_daily,
--   support_attachments, support_canned_responses,
--   user_segments_cache
-- ============================================================

-- ── support_attachments ──────────────────────────────────────
-- Users can read attachments on their own tickets

CREATE POLICY "support_attachments_user_read" ON support_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = support_attachments.ticket_id
        AND support_tickets.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "support_attachments_user_insert" ON support_attachments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = support_attachments.ticket_id
        AND support_tickets.user_id = (SELECT auth.uid())
    )
  );

-- ── support_canned_responses ─────────────────────────────────
-- Read-only for authenticated users (agents use these from admin panel
-- via service role; mobile support form can display them too)

CREATE POLICY "support_canned_responses_read_authenticated" ON support_canned_responses
  FOR SELECT TO authenticated
  USING (true);

-- ── admin_alerts — service-role only (no user-facing policies) ─
-- Supabase service role bypasses RLS. Adding a FALSE policy makes
-- intent explicit: authenticated users can NEVER read these.

CREATE POLICY "admin_alerts_deny_public" ON admin_alerts
  FOR ALL
  USING (false);

-- ── admin_audit_log — service-role only ──────────────────────

CREATE POLICY "admin_audit_log_deny_public" ON admin_audit_log
  FOR ALL
  USING (false);

-- ── cancellation_log — service-role only ─────────────────────
-- Written by cancel_job RPC (SECURITY DEFINER), read by admin.
-- Participants can see their own cancellation history.

CREATE POLICY "cancellation_log_participant_read" ON cancellation_log
  FOR SELECT
  USING (cancelled_by = (SELECT auth.uid()));

-- ── phone_otps — service-role only ───────────────────────────
-- All OTP operations go through SECURITY DEFINER RPCs; no direct access.

CREATE POLICY "phone_otps_deny_public" ON phone_otps
  FOR ALL
  USING (false);

-- ── platform_settings — service-role only ────────────────────

CREATE POLICY "platform_settings_deny_public" ON platform_settings
  FOR ALL
  USING (false);

-- ── platform_stats_daily — service-role only ─────────────────

CREATE POLICY "platform_stats_daily_deny_public" ON platform_stats_daily
  FOR ALL
  USING (false);

-- ── user_segments_cache — service-role only ──────────────────
-- Refreshed by pg_cron; read by notification edge function (service role).

CREATE POLICY "user_segments_cache_deny_public" ON user_segments_cache
  FOR ALL
  USING (false);
