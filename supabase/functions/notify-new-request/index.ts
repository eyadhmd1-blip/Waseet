// ============================================================
// WASEET — notify-new-request Edge Function
// Called after a normal (non-urgent) request is created.
//
// Sends push notifications + in-app inbox entries to:
//   Tier 1 — active subscribers         → "طلب جديد، قدّم عرضك"
//   Tier 2 — lapsed ≤30 days            → "طلب جديد، جدّد للمزاودة"
//   Tier 3 — lapsed 31-90 days          → same as tier 2, 1/day max
//             (cooldown enforced by RPC)
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

// ── Copy builders ─────────────────────────────────────────────

function buildActiveCopy(lang: string, catName: string, city: string) {
  if (lang === "en") {
    return {
      title: "📋 New request!",
      body:  `${catName} needed in ${city} — submit your bid now`,
    };
  }
  return {
    title: "📋 طلب جديد!",
    body:  `${catName} في ${city} — قدّم عرضك الآن`,
  };
}

function buildLapsedCopy(lang: string, catName: string, city: string) {
  if (lang === "en") {
    return {
      title: "📋 New request in your field",
      body:  `${catName} in ${city} — renew your subscription to bid`,
    };
  }
  return {
    title: "📋 طلب جديد في مجالك",
    body:  `${catName} في ${city} — جدّد اشتراكك للمزاودة`,
  };
}

// ── Main handler ──────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { request_id, city, category_slug } = await req.json() as {
      request_id:    string;
      city:          string;
      category_slug: string;
    };

    if (!request_id || !city || !category_slug) {
      return json({ error: "missing params" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Fetch request title and category name for notification copy
    const { data: reqRow } = await supabase
      .from("requests")
      .select("title, city")
      .eq("id", request_id)
      .single();

    // Use category_slug as fallback display name (Arabic-friendly)
    const catName = reqRow?.title ?? category_slug;
    const reqCity = reqRow?.city  ?? city;

    // Fetch tiered provider list (cooldown for tier 3 enforced in RPC)
    const { data: targets, error: rpcErr } = await supabase.rpc(
      "get_providers_for_new_request",
      { p_city: city, p_category_slug: category_slug }
    );

    if (rpcErr) return json({ error: rpcErr.message }, 500);
    if (!targets || targets.length === 0) {
      return json({ sent: 0, reason: "no_providers" });
    }

    // Fetch language preference for each provider
    const providerIds = targets.map((t: { provider_id: string }) => t.provider_id);
    const { data: langRows } = await supabase
      .from("users")
      .select("id, lang")
      .in("id", providerIds);

    const langMap = new Map(
      (langRows ?? []).map((u: { id: string; lang: string }) => [u.id, u.lang])
    );

    // Build push messages
    const messages = targets.map((t: {
      provider_id: string;
      token:       string;
      is_active:   boolean;
      days_lapsed: number;
    }) => {
      const lang = langMap.get(t.provider_id) ?? "ar";
      const { title, body } = t.is_active
        ? buildActiveCopy(lang, catName, reqCity)
        : buildLapsedCopy(lang, catName, reqCity);

      return {
        to:        t.token,
        title,
        body,
        data:      { screen: "providerFeed", request_id, notif_id: request_id },
        sound:     "default",
        priority:  "normal",
        channelId: "default",
      };
    });

    // Send in batches
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

    // Write in-app inbox notifications for every notified provider
    const inboxInserts = targets.map((t: {
      provider_id: string;
      is_active:   boolean;
    }) => {
      const lang = langMap.get(t.provider_id) ?? "ar";
      const { title, body } = t.is_active
        ? buildActiveCopy(lang, catName, reqCity)
        : buildLapsedCopy(lang, catName, reqCity);

      return {
        user_id:  t.provider_id,
        title,
        body,
        type:     "new_request",
        screen:   "providerFeed",
        metadata: { request_id },
      };
    });

    for (let i = 0; i < inboxInserts.length; i += 500) {
      await supabase
        .from("notifications")
        .insert(inboxInserts.slice(i, i + 500))
        .catch(() => {});
    }

    return json({ sent, total_providers: targets.length });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
