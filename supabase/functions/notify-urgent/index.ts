// ============================================================
// WASEET — notify-urgent Edge Function
// Called after an urgent request is created.
// Finds available providers in the same city+category and
// sends them a high-priority push notification in each
// provider's preferred language (users.lang).
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE    = 50;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function buildCopy(lang: string, reqTitle: string, city: string) {
  if (lang === "en") {
    return {
      title: "🚨 Urgent request!",
      body:  `${reqTitle} — ${city} · +25% bonus`,
    };
  }
  return {
    title: "🚨 طلب طارئ!",
    body:  `${reqTitle} — ${city} · +25% عمولة`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { request_id, city, category_slug } = await req.json() as {
      request_id: string;
      city: string;
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

    const { data: req_row } = await supabase
      .from("requests")
      .select("title, city")
      .eq("id", request_id)
      .single();

    const reqTitle = req_row?.title ?? "";
    const reqCity  = req_row?.city  ?? city;

    // RPC returns (provider_id UUID, token TEXT)
    const { data: targets } = await supabase.rpc("get_available_providers_for_urgent", {
      p_city:          city,
      p_category_slug: category_slug,
    });

    if (!targets || targets.length === 0) {
      return json({ sent: 0, reason: "no_available_providers" });
    }

    // Fetch language preferences for all providers
    const providerIds = targets.map((t: { provider_id: string }) => t.provider_id);
    const { data: langRows } = await supabase
      .from("users")
      .select("id, lang")
      .in("id", providerIds);

    const langMap = new Map((langRows ?? []).map((u: { id: string; lang: string }) => [u.id, u.lang]));

    const messages = targets.map((t: { provider_id: string; token: string }) => {
      const lang = langMap.get(t.provider_id) ?? "ar";
      const { title, body } = buildCopy(lang, reqTitle, reqCity);
      return {
        to:        t.token,
        title,
        body,
        data:      { screen: "urgent", request_id, notif_id: request_id },
        sound:     "default",
        priority:  "high",
        channelId: "urgent",
      };
    });

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
