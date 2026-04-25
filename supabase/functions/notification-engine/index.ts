// ============================================================
// WASEET — notification-engine  (DISABLED)
//
// Seasonal, lifecycle, and behavioral push notifications have
// been replaced by:
//   1. Transactional functions (notify-client-new-bid,
//      notify-providers-bid-rejected, etc.)
//   2. Manual admin broadcasts via the admin panel
//      (/admin/notifications)
//
// This function is kept as a no-op so any residual cron
// invocations from Supabase do not cause errors.
// To fully stop the cron: disable it in the Supabase dashboard
//   → Database → Extensions → pg_cron, or
//   → Settings → Edge Functions → notification-dispatcher
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  return new Response(
    JSON.stringify({ status: "disabled", message: "notification-engine is no longer active" }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
  );
});
