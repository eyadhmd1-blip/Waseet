// ============================================================
// WASEET — notify-contract Edge Function
// Called after a recurring contract is created.
// Finds subscribed providers in the same city + category and
// sends them a push notification in each provider's preferred
// language (users.lang).
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

function buildCopy(lang: string, contractTitle: string, city: string) {
  if (lang === "en") {
    return {
      title: "📋 New recurring contract",
      body:  `${contractTitle} — ${city}`,
    };
  }
  return {
    title: "📋 عقد دوري جديد",
    body:  `${contractTitle} — ${city}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { contract_id, city, category_slug } = await req.json() as {
      contract_id: string;
      city: string;
      category_slug: string;
    };
    if (!contract_id || !city || !category_slug) {
      return json({ error: "missing params" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: contract } = await supabase
      .from("recurring_contracts")
      .select("title")
      .eq("id", contract_id)
      .single();

    const contractTitle = contract?.title ?? "";

    // RPC returns (provider_id UUID, token TEXT)
    const { data: targets } = await supabase.rpc("get_available_providers_for_contract", {
      p_city:          city,
      p_category_slug: category_slug,
    });

    if (!targets || targets.length === 0) {
      return json({ sent: 0, reason: "no matching providers" });
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
      const { title, body } = buildCopy(lang, contractTitle, city);
      return {
        to:       t.token,
        title,
        body,
        data:     { screen: "contract_feed", contract_id },
        sound:    "default",
        priority: "high",
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
