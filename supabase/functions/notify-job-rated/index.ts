// ============================================================
// WASEET — notify-job-rated (M-6)
// Called by the client app immediately after rating a completed job.
// Notifies the provider of their new rating in the provider's
// preferred language (users.lang).
//
// Body: { job_id: string, rating: number, review?: string }
// Auth: must be the client on the job
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getServiceRoleKey, getAnonKey } from "../_shared/keys.ts";

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

function buildCopy(lang: string, rating: number, reqTitle: string) {
  const stars = "⭐".repeat(rating);
  if (lang === "en") {
    return {
      title: `${stars} You received a ${rating}-star rating!`,
      body:  `Client rated your work on: ${reqTitle}`,
    };
  }
  return {
    title: `${stars} حصلت على تقييم ${rating} نجوم!`,
    body:  `قيّم العميل خدمتك على: ${reqTitle}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      getAnonKey(),
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) return json({ error: "unauthorized" }, 401);

    const { job_id, rating, review } = await req.json() as {
      job_id: string;
      rating: number;
      review?: string;
    };
    if (!job_id || !rating) return json({ error: "job_id and rating required" }, 400);
    if (rating < 1 || rating > 5) return json({ error: "rating must be 1–5" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      getServiceRoleKey(),
      { auth: { persistSession: false } }
    );

    // Fetch job columns and the request title separately to avoid the
    // PostgREST "column client_id is ambiguous" error (client_id exists on
    // both jobs and requests when the request is embedded).
    const { data: job } = await admin
      .from("jobs")
      .select("provider_id, client_id, request_id")
      .eq("id", job_id)
      .single();

    if (!job) return json({ error: "job_not_found" }, 404);
    if (job.client_id !== user.id) return json({ error: "not_authorized" }, 403);

    const [{ data: tokenRow }, { data: providerUser }, { data: reqRow }] = await Promise.all([
      admin.from("push_tokens").select("token").eq("user_id", job.provider_id).maybeSingle(),
      admin.from("users").select("lang").eq("id", job.provider_id).maybeSingle(),
      admin.from("requests").select("title").eq("id", job.request_id).maybeSingle(),
    ]);

    const lang     = providerUser?.lang ?? "ar";
    const reqTitle = reqRow?.title ?? "";
    const { title, body } = buildCopy(lang, rating, reqTitle);

    // Insert in-app notification
    await admin.from("notifications").insert({
      user_id:  job.provider_id,
      title,
      body,
      type:     "job_rated",
      screen:   "/(provider)/jobs",
      metadata: { job_id, rating, review: review ?? null },
    }).then(() => {}).catch(() => {});

    if (!tokenRow?.token) return json({ sent: false, inbox: true, reason: "no_push_token" });

    const message = {
      to:       tokenRow.token,
      title,
      body,
      sound:    "default",
      priority: "default",
      data:     { screen: "/(provider)/jobs", job_id, type: "job_rated", rating },
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
