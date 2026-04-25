// ============================================================
// WASEET — notification-dispatcher  (DISABLED)
//
// The daily cron that fanned out notification-engine calls
// has been retired. Seasonal and lifecycle notifications are
// now handled manually via the admin panel broadcast feature.
//
// This function is kept as a no-op so any residual cron
// invocations from Supabase do not cause errors.
// To fully stop the cron: disable it in the Supabase dashboard
//   → Database → Extensions → pg_cron
//   Cron name: notification-dispatcher
//   Previous schedule: 0 6 * * * (06:00 UTC daily)
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
    JSON.stringify({ status: "disabled", message: "notification-dispatcher is no longer active" }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
  );
});
