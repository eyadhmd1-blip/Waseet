// ============================================================
// WASEET — Notification Engine Config
//
// At scale (>50k users) this function is NOT called by cron
// directly. Instead, notification-dispatcher (also an edge
// function) is scheduled and fans out batched invocations:
//
//   cron (06:00 UTC) → notification-dispatcher
//                        → notification-engine (batch 0)
//                        → notification-engine (batch 1)
//                        → notification-engine (batch N)
//
// For single-user testing or small deployments (<10k users),
// the engine can still be invoked directly:
//
//   curl -X POST https://<project>.supabase.co/functions/v1/notification-engine \
//     -H "Authorization: Bearer <service_role_key>" \
//     -H "Content-Type: application/json" \
//     -d '{ "dry_run": true, "user_id": "<uuid>" }'
//
// Dispatcher manual trigger:
//   curl -X POST https://<project>.supabase.co/functions/v1/notification-dispatcher \
//     -H "Authorization: Bearer <service_role_key>" \
//     -d '{ "dry_run": true }'
//
// With AI copy generation:
//   curl ... -d '{ "use_ai": true }'
//
// Deploy dispatcher with cron schedule:
//   supabase functions deploy notification-dispatcher --schedule "0 6 * * *"
// ============================================================

// Dispatcher cron: 06:00 UTC = 09:00 Jordan (UTC+3)
export const DISPATCHER_CRON_SCHEDULE = "0 6 * * *";

// Segments cache refresh: 03:00 UTC (3 hours before dispatcher fires)
// Registered via migration 018 pg_cron, not Supabase CLI schedule
export const SEGMENTS_REFRESH_CRON = "0 3 * * *";

// Users per notification-engine invocation
export const BATCH_SIZE = 500;

// Max simultaneous engine invocations per dispatcher wave
export const DISPATCHER_CONCURRENCY = 10;

// Phase 3: enable AI copy only for these segments to control cost
export const AI_SEGMENTS = ["dormant", "churned"] as const;

// Expo push: max messages per API call
export const EXPO_BATCH_SIZE = 100;

// Spam guard defaults (can be overridden per user in notification_preferences)
export const DEFAULT_COOLDOWN_DAYS: Record<string, number> = {
  new:     3,
  active:  7,
  dormant: 10,
  churned: 14,
};

export const DEFAULT_MAX_PER_WEEK = 2;
export const DEFAULT_QUIET_START  = 22; // 10 PM
export const DEFAULT_QUIET_END    = 8;  // 8 AM
