// ============================================================
// WASEET — notify-provider-bid-accepted
// Deno Edge Function
//
// Called by the mobile client immediately after accept_bid() succeeds.
// Sends a high-priority push notification to the winning provider.
//
// ENV vars (auto-injected by Supabase):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   SUPABASE_ANON_KEY
//
// Request body:
//   { job_id: string, is_urgent?: boolean }
//
// Response:
//   { sent: boolean } | { error: string }
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // ── Auth: verify caller is a logged-in user ───────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) return json({ error: "unauthorized" }, 401);

    // ── Parse body ────────────────────────────────────────────
    const { job_id, is_urgent = false } = await req.json() as {
      job_id: string;
      is_urgent?: boolean;
    };
    if (!job_id) return json({ error: "job_id required" }, 400);

    // ── Admin client (service role) ───────────────────────────
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // ── Fetch job with request + client details ───────────────
    const { data: job, error: jobErr } = await admin
      .from("jobs")
      .select(`
        id, provider_id, client_id, provider_commit_deadline,
        request:requests ( title, city, category_slug ),
        client:users!jobs_client_id_fkey ( full_name ),
        bid:bids ( amount, currency )
      `)
      .eq("id", job_id)
      .single();

    if (jobErr || !job) return json({ error: "job_not_found" }, 404);

    // Verify the caller is the client on this job
    if (job.client_id !== user.id) return json({ error: "not_authorized" }, 403);

    // ── Fetch provider push token ─────────────────────────────
    const { data: tokenRow } = await admin
      .from("push_tokens")
      .select("token")
      .eq("user_id", job.provider_id)
      .maybeSingle();

    if (!tokenRow?.token) {
      // No token — not a failure; provider may not have push enabled
      return json({ sent: false, reason: "no_push_token" });
    }

    // ── Compute minutes remaining ─────────────────────────────
    const deadline = job.provider_commit_deadline
      ? new Date(job.provider_commit_deadline)
      : null;
    const minutesLeft = deadline
      ? Math.max(1, Math.round((deadline.getTime() - Date.now()) / 60000))
      : (is_urgent ? 5 : 15);

    // ── Build push message ────────────────────────────────────
    const req_data = (job as any).request ?? {};
    const bid_data = (job as any).bid ?? {};
    const clientName = (job as any).client?.full_name ?? "عميل";

    const title = is_urgent
      ? "🚨 قبِل عميل عرضك — طلب طارئ!"
      : "✅ قبِل عميل عرضك!";

    const body = is_urgent
      ? `${req_data.title ?? "طلب"} · ${bid_data.amount ?? ""} ${bid_data.currency ?? "JOD"} +20% طارئ — أكّد خلال ${minutesLeft} دقائق`
      : `${req_data.title ?? "طلب"} · ${bid_data.amount ?? ""} ${bid_data.currency ?? "JOD"} — أكّد خلال ${minutesLeft} دقيقة`;

    const message = {
      to:       tokenRow.token,
      title,
      body,
      sound:    "default",
      priority: is_urgent ? "high" : "high",
      ttl:      minutesLeft * 60,
      data: {
        screen:    "provider_confirm",
        job_id,
        is_urgent,
        notif_id:  `job_commit_${job_id}`,
      },
      channelId: is_urgent ? "urgent" : "default",
    };

    // ── Send via Expo ─────────────────────────────────────────
    const expoRes = await fetch(EXPO_PUSH_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body:    JSON.stringify(message),
    });

    const expoData = await expoRes.json();
    const sent = expoData?.data?.status === "ok";

    // ── Also insert in-app notification ──────────────────────
    await admin.from("notifications").insert({
      user_id:  job.provider_id,
      title,
      body,
      type:     "job_commit_request",
      screen:   "provider_confirm",
      metadata: { job_id, is_urgent },
    }).then(() => {}).catch(() => {}); // non-blocking

    return json({ sent });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
