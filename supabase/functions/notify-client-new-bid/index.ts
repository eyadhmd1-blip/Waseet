// ============================================================
// WASEET — notify-client-new-bid
// Called by provider app after a bid is successfully submitted.
// Notifies the request owner (client) in their preferred language.
//
// Body: { request_id: string }
// Auth: must be the provider who submitted the bid
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

function buildCopy(lang: string, count: number, reqTitle: string, providerName: string) {
  if (lang === "en") {
    const title =
      count >= 5 ? `📈 You received ${count} bids` :
      count >= 3 ? `🎯 ${count} bids on your request` :
                   "💼 New bid on your request";
    const body  = count > 1
      ? `${reqTitle} — review bids now`
      : `${reqTitle} — ${providerName}`;
    return { title, body };
  }
  const title =
    count >= 5 ? `📈 وصلك ${count} عروض على طلبك` :
    count >= 3 ? `🎯 وصلك ${count} عروض على طلبك` :
                 "💼 وصلك عرض جديد على طلبك";
  const body  = count > 1
    ? `${reqTitle} — راجع العروض الآن`
    : `${reqTitle} — ${providerName}`;
  return { title, body };
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
      .select("client_id, title")
      .eq("id", request_id)
      .single();

    if (!request) return json({ error: "request_not_found" }, 404);

    const { data: bid } = await admin
      .from("bids")
      .select("id")
      .eq("request_id", request_id)
      .eq("provider_id", user.id)
      .eq("status", "pending")
      .maybeSingle();

    if (!bid) return json({ sent: false, reason: "no_bid_found" });

    const [
      { data: providerUser },
      { count: bidCount },
      { data: clientUser },
      { data: tokenRow },
    ] = await Promise.all([
      admin.from("users").select("full_name").eq("id", user.id).maybeSingle(),
      admin.from("bids").select("id", { count: "exact", head: true }).eq("request_id", request_id).eq("status", "pending"),
      admin.from("users").select("lang").eq("id", request.client_id).maybeSingle(),
      admin.from("push_tokens").select("token").eq("user_id", request.client_id).maybeSingle(),
    ]);

    if (!tokenRow?.token) return json({ sent: false, reason: "no_push_token" });

    const lang         = clientUser?.lang ?? "ar";
    const providerName = providerUser?.full_name ?? (lang === "en" ? "Provider" : "مزود");
    const count        = bidCount ?? 1;

    const { title, body } = buildCopy(lang, count, request.title, providerName);

    const message = {
      to:        tokenRow.token,
      title,
      body,
      sound:     "default",
      priority:  "high",
      data: {
        screen:   "new-request",
        request_id,
        notif_id: `bid_notif_${request_id}`,
      },
      channelId: "default",
    };

    const expoRes = await fetch(EXPO_PUSH_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body:    JSON.stringify(message),
    });

    const expoData = await expoRes.json();
    const sent = expoData?.data?.status === "ok";

    return json({ sent });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
