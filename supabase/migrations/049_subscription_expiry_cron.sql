-- ============================================================
-- Migration 049: Register notify-subscription-expiry cron schedule
-- ============================================================
-- Deploy command (run once after migration):
--   supabase functions deploy notify-subscription-expiry --schedule "0 5 * * *"
--
-- Schedule: 05:00 UTC daily = 08:00 Jordan time (UTC+3)
-- Purpose : Sends push notifications for:
--   1. Subscription expiring in 3 days
--   2. Subscription expiring in 1 day
--   3. Low bid credits (1-3 remaining)
--   4. Zero bid credits
--   5. Trial ended (trial_used=true, is_subscribed=false)
-- ============================================================

-- No SQL changes needed — Edge Function scheduling is managed
-- via Supabase CLI:
--   supabase functions deploy notify-subscription-expiry \
--     --schedule "0 5 * * *"
--
-- Full cron registry (all 5 jobs):
--   NAME                          SCHEDULE      PURPOSE
--   sweep-job-commitments         * * * * *     Cancel expired commitment windows
--   expire-urgent-requests        * * * * *     Cancel timed-out urgent requests
--   refresh-user-segments         0 3 * * *     Materialise user_segments_cache
--   notification-dispatcher       0 6 * * *     Fan-out daily push notifications
--   notify-subscription-expiry    0 5 * * *     Subscription expiry + trial ended alerts

SELECT 1; -- no-op to satisfy migration runner
