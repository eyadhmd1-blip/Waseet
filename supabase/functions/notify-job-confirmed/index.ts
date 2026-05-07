// ============================================================
// WASEET — notify-job-confirmed (M-4)
// Called by the confirm-job edge function after a job is
// successfully confirmed (client enters 6-digit code).
// Notifies the provider that their work is confirmed and
// payment is on the way — in the provider's preferred language.
//
// Body: { job_id: string }
// Auth: must be the client on the job
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

function buildCopy(lang: string, reqTitle: string) {
  if (lang === "en") {
    return {
      title: "✅ Job confirmed — great work!",
      body:  `The client confirmed completion of: ${reqTitle}. Check your completed jobs.`,
    };
  }
  return {
    title: "✅ تم تأكيد إنجاز العمل!",
    body:  `أكّد العميل إنجاز: ${reqTitle}. يمكنك مراجعة أعمالك المكتملة.`,
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

    const { job_id } = await req.json() as { job_id: string };
    if (!job_id) return json({ error: "job_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: job } = await admin
      .from("jobs")
      .select("provider_id, client_id, request_id, request:requests(title)")
      .eq("id", job_id)
      .single();

    if (!job) return json({ error: "job_not_found" }, 404);
    if (job.client_id !== user.id) return json({ error: "not_authorized" }, 403);

    const [{ data: tokenRow }, { data: providerUser }] = await Promise.all([
      admin.from("push_tokens").select("token").eq("user_id", job.provider_id).maybeSingle(),
      admin.from("users").select("lang").eq("id", job.provider_id).maybeSingle(),
    ]);

    const lang     = providerUser?.lang ?? "ar";
    const reqTitle = (job as any).request?.title ?? "";
    const { title, body } = buildCopy(lang, reqTitle);

    // Insert in-app notification
    await admin.from("notifications").insert({
      user_id:  job.provider_id,
      title,
      body,
      type:     "confirm_job",
      screen:   "/(provider)/jobs",
      metadata: { job_id },
    }).then(() => {}).catch(() => {});

    if (!tokenRow?.token) return json({ sent: false, inbox: true, reason: "no_push_token" });

    const message = {
      to:       tokenRow.token,
      title,
      body,
      sound:    "default",
      priority: "high",
      data:     { screen: "/(provider)/jobs", job_id, type: "confirm_job" },
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
