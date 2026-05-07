// ============================================================
// WASEET — notify-contract-bid-accepted (M-7)
// Called by the client app immediately after accept_contract_bid()
// succeeds. Notifies the winning provider in their preferred
// language (users.lang).
//
// Body: { contract_id: string, provider_id: string }
// Auth: must be the client who owns the contract
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function buildCopy(lang: string, contractTitle: string) {
  if (lang === "en") {
    return {
      title: "🤝 Contract accepted — congratulations!",
      body:  `The client accepted your bid on: ${contractTitle}. Check your active contracts.`,
    };
  }
  return {
    title: "🤝 تم قبول عرضك على العقد!",
    body:  `قبِل العميل عرضك على: ${contractTitle}. راجع عقودك النشطة.`,
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

    const { contract_id, provider_id } = await req.json() as {
      contract_id: string;
      provider_id: string;
    };
    if (!contract_id || !provider_id) return json({ error: "contract_id and provider_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: contract } = await admin
      .from("recurring_contracts")
      .select("title, client_id")
      .eq("id", contract_id)
      .single();

    if (!contract) return json({ error: "contract_not_found" }, 404);
    if (contract.client_id !== user.id) return json({ error: "not_authorized" }, 403);

    const [{ data: tokenRow }, { data: providerUser }] = await Promise.all([
      admin.from("push_tokens").select("token").eq("user_id", provider_id).maybeSingle(),
      admin.from("users").select("lang").eq("id", provider_id).maybeSingle(),
    ]);

    const lang = providerUser?.lang ?? "ar";
    const { title, body } = buildCopy(lang, contract.title);

    // Insert in-app notification (DB trigger in migration 057 also does this,
    // but push notification requires the edge function)
    await admin.from("notifications").insert({
      user_id:  provider_id,
      title,
      body,
      type:     "contract_bid_accepted",
      screen:   "/(provider)/profile",
      metadata: { contract_id },
    }).then(() => {}).catch(() => {});

    if (!tokenRow?.token) return json({ sent: false, inbox: true, reason: "no_push_token" });

    const message = {
      to:       tokenRow.token,
      title,
      body,
      sound:    "default",
      priority: "high",
      data:     { screen: "/(provider)/profile", contract_id, type: "contract_bid_accepted" },
      channelId: "default",
    };

    const expoRes = await fetch(EXPO_PUSH_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body:    JSON.stringify(message),
    });

    const expoData = await expoRes.json();
    return json({ sent: expoData?.data?.status === "ok", inbox: true });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
