// ============================================================
// WASEET — notify-providers-bid-rejected
// Called by client app immediately after accept_bid() succeeds.
// Notifies all providers whose bids on the same request were
// rejected (i.e. they lost to the accepted provider).
//
// Body: { request_id: string }
// Auth: must be the client who owns the request
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE    = 50;

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
    // ── Auth: verify caller is a logged-in client ─────────────
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
    const { request_id } = await req.json() as { request_id: string };
    if (!request_id) return json({ error: "request_id required" }, 400);

    // ── Admin client ──────────────────────────────────────────
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // ── Verify caller is the client of this request ───────────
    const { data: request } = await admin
      .from("requests")
      .select("client_id, title")
      .eq("id", request_id)
      .single();

    if (!request) return json({ error: "request_not_found" }, 404);
    if (request.client_id !== user.id) return json({ error: "not_authorized" }, 403);

    // ── Get all rejected bids (providers who lost) ────────────
    const { data: rejectedBids } = await admin
      .from("bids")
      .select("provider_id")
      .eq("request_id", request_id)
      .eq("status", "rejected");

    if (!rejectedBids || rejectedBids.length === 0) {
      return json({ sent: 0, reason: "no_rejected_bids" });
    }

    const providerIds = rejectedBids.map((b) => b.provider_id);

    // ── Fetch push tokens for rejected providers ──────────────
    const { data: tokens } = await admin
      .from("push_tokens")
      .select("token, user_id")
      .in("user_id", providerIds);

    if (!tokens || tokens.length === 0) {
      return json({ sent: 0, reason: "no_tokens" });
    }

    // ── Build Expo messages ───────────────────────────────────
    const messages = tokens.map((t) => ({
      to:        t.token,
      title:     "📌 اختار العميل مزوداً آخر",
      body:      `طلب: ${request.title} — لا تستسلم، هناك طلبات أخرى!`,
      sound:     "default",
      priority:  "normal",
      data:      { screen: "home", notif_id: `bid_rejected_${request_id}_${t.user_id}` },
      channelId: "default",
    }));

    // ── Send in batches ───────────────────────────────────────
    let sent = 0;
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const res = await fetch(EXPO_PUSH_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body:    JSON.stringify(batch),
      });
      if (res.ok) sent += batch.length;
    }

    return json({ sent });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
