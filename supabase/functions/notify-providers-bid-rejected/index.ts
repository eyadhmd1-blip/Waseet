// ============================================================
// WASEET — notify-providers-bid-rejected  (v3 — bilingual)
//
// Called by client app immediately after accept_bid() succeeds.
// Sends a personalised push notification to every provider whose
// bid was rejected, in each provider's preferred language.
//
// Message tone is tailored to the provider's consecutive_losses:
//   1–3  → encouraging
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

function buildMessage(
  token:           string,
  providerId:      string,
  lang:            string,
  requestTitle:    string,
  totalBids:       number,
  newRequestCount: number,
  losses:          number,
): object {
  const isMilestone = losses > 0 && losses % 7 === 0;

  let title: string;
  let body:  string;

  if (lang === "en") {
    const newReqStr = newRequestCount > 0 ? ` · ${newRequestCount} new request in your specialty` : "";
    if (isMilestone) {
      title = "🏆 Perseverance reward — free credits!";
      body  = `You applied ${losses} times seriously — free credits added. Keep going, the next one is yours.`;
    } else if (losses >= 4) {
      title = "💪 We see your persistence";
      body  = `"${requestTitle}" — client chose from ${totalBids} bids. A strong profile multiplies your chances.${newReqStr}`;
    } else {
      title = "🌟 The next opportunity is on its way";
      body  = `"${requestTitle}" — you were 1 of ${totalBids} providers. Every attempt builds your reputation.${newReqStr}`;
    }
  } else {
    const newReqStr = newRequestCount > 0 ? ` · ${newRequestCount} طلب جديد في تخصصك` : "";
    if (isMilestone) {
      title = "🏆 مكافأة المثابرة — رصيد مجاني!";
      body  = `تقدّمت ${losses} مرة بجدية — أُضيف رصيد مجاني إلى حسابك. استمر، الفرصة القادمة لك.`;
    } else if (losses >= 4) {
      title = "💪 نحن نرى مثابرتك";
      body  = `"${requestTitle}" — اختار العميل من بين ${totalBids} عروض. ملف شخصي قوي يُضاعف فرصك.${newReqStr}`;
    } else {
      title = "🌟 الفرصة القادمة في طريقها إليك";
      body  = `"${requestTitle}" — كنت 1 من ${totalBids} مزودين هذه المرة. كل محاولة تبني سمعتك.${newReqStr}`;
    }
  }

  return {
    to:        token,
    title,
    body,
    sound:     "default",
    priority:  "high",
    data: {
      screen:       "provider_feed",
      notif_id:     `bid_rejected_${providerId}`,
      show_profile: losses >= 4 && !isMilestone,
    },
    channelId: "default",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
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

    const { data: request } = await admin
      .from("requests")
      .select("client_id, title, category_slug, city")
      .eq("id", request_id)
      .single();

    if (!request)                       return json({ error: "request_not_found" }, 404);
    if (request.client_id !== user.id)  return json({ error: "not_authorized" },   403);

    const [{ count: totalBids }, { count: newRequestCount }] = await Promise.all([
      admin.from("bids").select("id", { count: "exact", head: true }).eq("request_id", request_id),
      admin.from("requests").select("id", { count: "exact", head: true })
        .eq("status", "open").eq("category_slug", request.category_slug)
        .eq("city", request.city).neq("id", request_id),
    ]);

    const { data: rejectedBids } = await admin
      .from("bids")
      .select("provider_id, provider:providers!inner(consecutive_losses, subscription_tier)")
      .eq("request_id", request_id)
      .eq("status", "rejected");

    if (!rejectedBids || rejectedBids.length === 0) {
      return json({ sent: 0, reason: "no_rejected_bids" });
    }

    const providerIds = rejectedBids.map((b: any) => b.provider_id);

    // Fetch push tokens and language preferences in parallel
    const [{ data: tokens }, { data: langRows }] = await Promise.all([
      admin.from("push_tokens").select("token, user_id").in("user_id", providerIds),
      admin.from("users").select("id, lang").in("id", providerIds),
    ]);

    if (!tokens || tokens.length === 0) return json({ sent: 0, reason: "no_tokens" });

    const bidMap  = new Map((rejectedBids as any[]).map((b) => [b.provider_id, b]));
    const langMap = new Map((langRows ?? []).map((u: { id: string; lang: string }) => [u.id, u.lang]));

    const messages = tokens.map((t: any) => {
      const bid    = bidMap.get(t.user_id);
      const losses = bid?.provider?.consecutive_losses ?? 0;
      const lang   = langMap.get(t.user_id) ?? "ar";
      return buildMessage(t.token, t.user_id, lang, request.title, totalBids ?? 0, newRequestCount ?? 0, losses);
    });

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

    // In-app notifications for milestone providers
    const milestoneInserts = (rejectedBids as any[])
      .filter((b) => { const l = b.provider?.consecutive_losses ?? 0; return l > 0 && l % 7 === 0; })
      .map((b) => {
        const lang  = langMap.get(b.provider_id) ?? "ar";
        const title = lang === "en" ? "🏆 Perseverance reward — free credits!" : "🏆 مكافأة المثابرة — رصيد مجاني!";
        const body  = lang === "en"
          ? `You applied ${b.provider.consecutive_losses} times seriously — free credits added.`
          : `تقدّمت ${b.provider.consecutive_losses} مرة بجدية — أُضيف رصيد مجاني إلى حسابك.`;
        return {
          user_id:  b.provider_id,
          title,
          body,
          type:     "perseverance_reward",
          screen:   "provider_feed",
          metadata: { consecutive_losses: b.provider.consecutive_losses },
        };
      });

    if (milestoneInserts.length > 0) {
      await admin.from("notifications").insert(milestoneInserts).then(() => {}).catch(() => {});
    }

    return json({ sent });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
