// ============================================================
// WASEET — notify-providers-bid-rejected  (v2)
//
// Called by client app immediately after accept_bid() succeeds.
// Sends a personalised push notification to every provider whose
// bid was rejected on this request.
//
// Message tone is tailored to the provider's consecutive_losses:
//   1–3  → encouraging ("الفرصة القادمة لك")
//   4–6  → profile-improvement tip
//   7,14,… (multiples of 7) → perseverance reward notice
//
// Body: { request_id: string }
// Auth: must be the client who owns the request
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE    = 50;

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

// ── Message builder ───────────────────────────────────────────

function buildMessage(
  token:           string,
  providerId:      string,
  requestTitle:    string,
  totalBids:       number,
  newRequestCount: number,
  losses:          number,        // consecutive_losses after trigger update
): object {
  const isMilestone = losses > 0 && losses % 7 === 0;
  const newReqStr   = newRequestCount > 0
    ? ` · ${newRequestCount} طلب جديد في تخصصك`
    : "";

  let title: string;
  let body:  string;

  if (isMilestone) {
    // Tier 3: perseverance reward
    title = "🏆 مكافأة المثابرة — رصيد مجاني!";
    body  = `تقدّمت ${losses} مرة بجدية — أُضيف رصيد مجاني إلى حسابك. استمر، الفرصة القادمة لك.`;
  } else if (losses >= 4) {
    // Tier 2: profile-improvement tip (4–6 losses)
    title = "💪 نحن نرى مثابرتك";
    body  = `"${requestTitle}" — اختار العميل من بين ${totalBids} عروض. ملف شخصي قوي يُضاعف فرصك.${newReqStr}`;
  } else {
    // Tier 1: general encouragement (1–3 losses)
    title = "🌟 الفرصة القادمة في طريقها إليك";
    body  = `"${requestTitle}" — كنت 1 من ${totalBids} مزودين هذه المرة. كل محاولة تبني سمعتك.${newReqStr}`;
  }

  return {
    to:        token,
    title,
    body,
    sound:     "default",
    priority:  "normal",
    data: {
      screen:      "provider_feed",   // opens feed, not generic home
      notif_id:    `bid_rejected_${providerId}`,
      show_profile: losses >= 4 && !isMilestone,   // hint to show profile tip
    },
    channelId: "default",
  };
}

// ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // ── Auth ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) return json({ error: "unauthorized" }, 401);

    const { request_id } = await req.json() as { request_id: string };
    if (!request_id) return json({ error: "request_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // ── Verify caller owns the request; get title + category ──
    const { data: request } = await admin
      .from("requests")
      .select("client_id, title, category_slug, city")
      .eq("id", request_id)
      .single();

    if (!request)                         return json({ error: "request_not_found" }, 404);
    if (request.client_id !== user.id)    return json({ error: "not_authorized" },   403);

    // ── Total bids on this request (context for message) ──────
    const { count: totalBids } = await admin
      .from("bids")
      .select("id", { count: "exact", head: true })
      .eq("request_id", request_id);

    // ── Count open requests in same city + category (redirect hook) ─
    const { count: newRequestCount } = await admin
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("status",        "open")
      .eq("category_slug", request.category_slug)
      .eq("city",          request.city)
      .neq("id",           request_id);

    // ── Fetch rejected providers with their profile + push token ──
    const { data: rejectedBids } = await admin
      .from("bids")
      .select(`
        provider_id,
        provider:providers!inner(
          consecutive_losses,
          subscription_tier
        )
      `)
      .eq("request_id", request_id)
      .eq("status",     "rejected");

    if (!rejectedBids || rejectedBids.length === 0)
      return json({ sent: 0, reason: "no_rejected_bids" });

    const providerIds = rejectedBids.map((b: any) => b.provider_id);

    // ── Fetch push tokens for all rejected providers ───────────
    const { data: tokens } = await admin
      .from("push_tokens")
      .select("token, user_id")
      .in("user_id", providerIds);

    if (!tokens || tokens.length === 0)
      return json({ sent: 0, reason: "no_tokens" });

    // Build a map: provider_id → bid row
    const bidMap = new Map(
      (rejectedBids as any[]).map((b) => [b.provider_id, b])
    );

    // ── Build personalised push messages ──────────────────────
    const messages = tokens.map((t: any) => {
      const bid        = bidMap.get(t.user_id);
      const losses     = bid?.provider?.consecutive_losses ?? 0;
      return buildMessage(
        t.token,
        t.user_id,
        request.title,
        totalBids  ?? 0,
        newRequestCount ?? 0,
        losses,
      );
    });

    // ── Send in batches ───────────────────────────────────────
    let sent = 0;
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const res   = await fetch(EXPO_PUSH_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body:    JSON.stringify(batch),
      });
      if (res.ok) sent += batch.length;
    }

    // ── In-app notifications for milestone providers ───────────
    // For providers who just hit a multiple of 7, insert an in-app
    // notification row so it appears in their notification centre.
    const milestoneInserts = (rejectedBids as any[])
      .filter((b) => {
        const l = b.provider?.consecutive_losses ?? 0;
        return l > 0 && l % 7 === 0;
      })
      .map((b) => ({
        user_id:  b.provider_id,
        title:    "🏆 مكافأة المثابرة — رصيد مجاني!",
        body:     `تقدّمت ${b.provider.consecutive_losses} مرة بجدية — أُضيف رصيد مجاني إلى حسابك.`,
        type:     "perseverance_reward",
        screen:   "provider_feed",
        metadata: { consecutive_losses: b.provider.consecutive_losses },
      }));

    if (milestoneInserts.length > 0) {
      await admin
        .from("notifications")
        .insert(milestoneInserts)
        .then(() => {})
        .catch(() => {}); // non-blocking — table may not exist yet
    }

    return json({ sent });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
