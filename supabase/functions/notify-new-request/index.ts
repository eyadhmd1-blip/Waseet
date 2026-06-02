// ============================================================
// WASEET — notify-new-request Edge Function
// Notifies matching providers when a new (non-urgent) request is posted.
//
// Callers:
//   (a) DB trigger (after INSERT on requests) — Authorization: Bearer <service_role_key>
//       Body: { request_id, city, category_slug, client_id }
//   (b) Mobile app (fire-and-forget after request submit) — Authorization: Bearer <user_jwt>
//       Body: { request_id, city, category_slug }
//
// Sends push notifications + in-app inbox entries to:
//   Tier 1 — active subscribers         → "طلب جديد، قدّم عرضك"
//   Tier 2 — lapsed ≤30 days            → "طلب جديد، جدّد للمزاودة"
//   Tier 3 — lapsed 31-90 days          → same as tier 2, 1/day max
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getServiceRoleKey, getAnonKey } from "../_shared/keys.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    // Read body once — Deno body can only be consumed once
    const reqBody = await req.json() as {
      request_id:    string;
      city:          string;
      category_slug: string;
      client_id?:    string;
    };

    const { request_id, city, category_slug, client_id: bodyClientId } = reqBody;
    if (!request_id || !city || !category_slug) {
      return json({ error: "missing params" }, 400);
    }

    // Detect if called from a DB trigger (service_role key) vs mobile app (user JWT)
    const serviceKey    = getServiceRoleKey();
    const isTriggerCall = serviceKey !== "" && authHeader === `Bearer ${serviceKey}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      getServiceRoleKey(),
      { auth: { persistSession: false } }
    );

    if (isTriggerCall) {
      // Called from DB trigger — ownership already guaranteed by the trigger
      // client_id must be supplied in the body
      if (!bodyClientId) return json({ error: "client_id required" }, 400);
    } else {
      // Called from mobile app — verify the caller owns the request
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        getAnonKey(),
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authErr } = await anonClient.auth.getUser();
      if (authErr || !user) return json({ error: "unauthorized" }, 401);

      const { data: reqRow } = await supabase
        .from("requests")
        .select("client_id")
        .eq("id", request_id)
        .single();

      if (!reqRow || reqRow.client_id !== user.id) {
        return json({ error: "request_not_found_or_unauthorized" }, 403);
      }
    }

    // Fetch request title for notification copy
    const { data: reqRow } = await supabase
      .from("requests")
      .select("title, city")
      .eq("id", request_id)
      .single();

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
