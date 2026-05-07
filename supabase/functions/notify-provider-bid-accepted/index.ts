// ============================================================
// WASEET — notify-provider-bid-accepted
// Deno Edge Function
//
// Called by the mobile client immediately after accept_bid() succeeds.
// Sends a high-priority push notification to the winning provider
// in the provider's preferred language (users.lang).
//
// Request body: { job_id: string, is_urgent?: boolean }
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

function buildCopy(lang: string, isUrgent: boolean, reqTitle: string, amount: unknown, currency: string, minutes: number) {
  if (lang === "en") {
    const title = isUrgent ? "🚨 Client accepted your bid — urgent!" : "✅ Client accepted your bid!";
    const body  = isUrgent
      ? `${reqTitle} · ${amount} ${currency} +20% urgent — confirm within ${minutes} min`
      : `${reqTitle} · ${amount} ${currency} — confirm within ${minutes} min`;
    return { title, body };
  }
  const title = isUrgent ? "🚨 قبِل عميل عرضك — طلب طارئ!" : "✅ قبِل عميل عرضك!";
  const body  = isUrgent
    ? `${reqTitle} · ${amount} ${currency} +20% طارئ — أكّد خلال ${minutes} دقائق`
    : `${reqTitle} · ${amount} ${currency} — أكّد خلال ${minutes} دقيقة`;
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

    const { job_id, is_urgent = false } = await req.json() as {
      job_id: string;
      is_urgent?: boolean;
    };
    if (!job_id) return json({ error: "job_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: job, error: jobErr } = await admin
      .from("jobs")
      .select(`
        id, provider_id, client_id, provider_commit_deadline,
        request:requests ( title, city, category_slug ),
        client:users!jobs_client_id_fkey ( full_name ),
        bid:bids ( amount, currency )
      `)
      .eq("id", job_id)
      .single();

    if (jobErr || !job) return json({ error: "job_not_found" }, 404);
    if (job.client_id !== user.id) return json({ error: "not_authorized" }, 403);

    // Fetch provider push token + language preference
    const [{ data: tokenRow }, { data: providerUser }] = await Promise.all([
      admin.from("push_tokens").select("token").eq("user_id", job.provider_id).maybeSingle(),
      admin.from("users").select("lang").eq("id", job.provider_id).maybeSingle(),
    ]);

    if (!tokenRow?.token) return json({ sent: false, reason: "no_push_token" });

    const lang = providerUser?.lang ?? "ar";

    const deadline = job.provider_commit_deadline ? new Date(job.provider_commit_deadline) : null;
    const minutesLeft = deadline
      ? Math.max(1, Math.round((deadline.getTime() - Date.now()) / 60000))
      : (is_urgent ? 5 : 15);

    const req_data = (job as any).request ?? {};
    const bid_data = (job as any).bid ?? {};

    const { title, body } = buildCopy(
      lang, is_urgent,
      req_data.title ?? "",
      bid_data.amount ?? "",
      bid_data.currency ?? "JOD",
      minutesLeft
    );

    const message = {
      to:       tokenRow.token,
      title,
      body,
      sound:    "default",
      priority: "high",
      ttl:      minutesLeft * 60,
      data: {
        screen:    "provider_confirm",
        job_id,
        is_urgent,
        notif_id:  `job_commit_${job_id}`,
      },
      channelId: is_urgent ? "urgent" : "default",
    };

    const expoRes = await fetch(EXPO_PUSH_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body:    JSON.stringify(message),
    });

    const expoData = await expoRes.json();
    const sent = expoData?.data?.status === "ok";

    await admin.from("notifications").insert({
      user_id:  job.provider_id,
      title,
      body,
      type:     "job_commit_request",
      screen:   "provider_confirm",
      metadata: { job_id, is_urgent },
    }).then(() => {}).catch(() => {});

    return json({ sent });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
