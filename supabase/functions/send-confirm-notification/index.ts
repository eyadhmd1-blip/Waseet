// Supabase Edge Function — send-confirm-notification
// Deno runtime
//
// Called after provider presses "أنجزت العمل".
// Generates the 6-digit confirmation code server-side (never client-side),
// stores it in jobs, then notifies the client.
//
// Body: { job_id: string, client_id: string }
// Response: { sent: boolean, inbox: boolean }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getServiceRoleKey, getAnonKey } from "../_shared/keys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildCopy(lang: string, code: string) {
  if (lang === "en") {
    return {
      title: "Job completion code 🔑",
      body:  `Your code: ${code} — give it to the provider. Valid 30 min.`,
    };
  }
  return {
    title: "رمز تأكيد إنجاز العمل 🔑",
    body:  `رمز تأكيدك: ${code} — أعطه للمقدم لإتمام العمل. صالح 30 دقيقة.`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      getAnonKey(),
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser();
    if (authErr || !user) return json({ error: "unauthorized" }, 401);

    const { job_id, client_id } = await req.json() as {
      job_id: string;
      client_id: string;
    };
    if (!job_id || !client_id) {
      return json({ error: "job_id and client_id are required" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      getServiceRoleKey(),
      { auth: { persistSession: false } }
    );

    // Verify caller is the provider for this job
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("jobs")
      .select("id, provider_id, status")
      .eq("id", job_id)
      .single();

    if (jobErr || !job) return json({ error: "job_not_found" }, 404);
    if (job.provider_id !== user.id) return json({ error: "unauthorized" }, 403);
    if (job.status !== "active") return json({ error: "job_not_active" }, 400);

    // Generate code server-side — never trust client-provided values
    const code = (100000 + Math.floor(Math.random() * 900000)).toString();
    const exp  = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes

    // Store in DB via service role
    const { error: updateErr } = await supabaseAdmin
      .from("jobs")
      .update({ confirm_code: code, confirm_code_exp: exp, confirm_attempts: 0 })
      .eq("id", job_id);

    if (updateErr) return json({ error: "db_update_failed" }, 500);

    // Fetch client's language preference
    const { data: clientUser } = await supabaseAdmin
      .from("users")
      .select("lang")
      .eq("id", client_id)
      .maybeSingle();

    const lang = clientUser?.lang ?? "ar";
    const { title, body } = buildCopy(lang, code);

    // 1. Always insert into notifications inbox
    const { error: inboxErr } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id:  client_id,
        title,
        body,
        type:     "confirm_job",
        screen:   "/(client)/requests",
        metadata: { job_id },
      });

    const inbox = !inboxErr;

    // 2. Attempt push notification if token available
    const { data: tokenRow } = await supabaseAdmin
      .from("push_tokens")
      .select("token")
      .eq("user_id", client_id)
      .single();

    if (!tokenRow?.token) {
      return json({ sent: false, inbox, reason: "no_token" });
    }

    const message = {
      to:    tokenRow.token,
      sound: "default",
      title,
      body,
      data:  { job_id, type: "confirm_job", screen: "/(client)/requests" },
      ttl:   1800,
    };

    const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body:    JSON.stringify(message),
    });

    const expoData = await expoRes.json();
    const sent = expoData?.data?.status === "ok";

    return json({ sent, inbox });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
