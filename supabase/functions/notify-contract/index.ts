// ============================================================
// WASEET — notify-contract Edge Function
// Called after a recurring contract is created.
//
// Sends push notifications + in-app inbox entries to:
//   Tier 1 — active subscribers         → "عقد دوري جديد، قدّم عرضك"
//   Tier 2 — lapsed ≤30 days            → "عقد دوري جديد، جدّد للمزاودة"
//   Tier 3 — lapsed 31-90 days          → same as tier 2, 1/day max
//             (cooldown enforced by RPC)
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getServiceRoleKey } from "../_shared/keys.ts";

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

function buildActiveCopy(lang: string, contractTitle: string, city: string) {
  if (lang === "en") {
    return {
      title: "📋 New recurring contract!",
      body:  `${contractTitle} — ${city} · submit your bid now`,
    };
  }
  return {
    title: "📋 عقد دوري جديد!",
    body:  `${contractTitle} — ${city} · قدّم عرضك الآن`,
  };
}

function buildLapsedCopy(lang: string, contractTitle: string, city: string) {
  if (lang === "en") {
    return {
      title: "📋 New recurring contract in your field",
      body:  `${contractTitle} — ${city} · renew your subscription to bid`,
    };
  }
  return {
    title: "📋 عقد دوري جديد في مجالك",
    body:  `${contractTitle} — ${city} · جدّد اشتراكك للمزاودة`,
  };
}

// ── Main handler ──────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { contract_id, city, category_slug } = await req.json() as {
      contract_id:   string;
      city:          string;
      category_slug: string;
    };

    if (!contract_id || !city || !category_slug) {
      return json({ error: "missing params" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      getServiceRoleKey(),
      { auth: { persistSession: false } }
    );

    const { data: contract } = await supabase
      .from("recurring_contracts")
      .select("title")
      .eq("id", contract_id)
      .single();

    const contractTitle = contract?.title ?? "";

    // Tiered provider list (cooldown for tier 3 enforced in RPC)
    const { data: targets, error: rpcErr } = await supabase.rpc(
      "get_available_providers_for_contract",
      { p_city: city, p_category_slug: category_slug }
    );

    if (rpcErr) return json({ error: rpcErr.message }, 500);
    if (!targets || targets.length === 0) {
      return json({ sent: 0, reason: "no matching providers" });
    }

    // Fetch language preferences
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
        ? buildActiveCopy(lang, contractTitle, city)
        : buildLapsedCopy(lang, contractTitle, city);

      return {
        to:       t.token,
        title,
        body,
        data:     { screen: "contract_feed", contract_id, notif_id: contract_id },
        sound:    "default",
        priority: "normal",
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

    // Write in-app inbox notifications
    const inboxInserts = targets.map((t: {
      provider_id: string;
      is_active:   boolean;
    }) => {
      const lang = langMap.get(t.provider_id) ?? "ar";
      const { title, body } = t.is_active
        ? buildActiveCopy(lang, contractTitle, city)
        : buildLapsedCopy(lang, contractTitle, city);

      return {
        user_id:  t.provider_id,
        title,
        body,
        type:     "new_contract",
        screen:   "contract_feed",
        metadata: { contract_id },
      };
    });

    for (let i = 0; i < inboxInserts.length; i += 500) {
      await supabase
        .from("notifications")
        .insert(inboxInserts.slice(i, i + 500))
        .then(() => {})
        .catch(() => {});
    }

    return json({ sent, total_providers: targets.length });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
