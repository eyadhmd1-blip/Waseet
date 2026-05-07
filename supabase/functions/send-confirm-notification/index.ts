// Supabase Edge Function — send-confirm-notification
// Deno runtime
//
// Called after provider presses "أنجزت العمل" to notify the client.
// Delivery strategy (in order):
//   1. Always insert into notifications table (in-app inbox) — guaranteed delivery
//   2. Attempt Expo push notification if client has a push token
//
// ENV vars required:
//   SUPABASE_URL               — auto-injected
//   SUPABASE_SERVICE_ROLE_KEY  — auto-injected
//
// Request body: { job_id: string, client_id: string, code: string }
// Response:     { sent: boolean, inbox: boolean }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    // ── Auth ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser();
    if (authErr || !user) return json({ error: "unauthorized" }, 401);

    // ── Parse ─────────────────────────────────────────────────
    const { job_id, client_id, code } = await req.json() as {
      job_id: string;
      client_id: string;
      code: string;
    };
    if (!job_id || !client_id || !code) {
      return json({ error: "job_id, client_id and code are required" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // ── 1. Always: insert into notifications inbox ────────────
    // Client sees this immediately when they open the app — no push token needed.
    const { error: inboxErr } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id:  client_id,
        title:    "رمز تأكيد إنجاز العمل 🔑",
        body:     `رمز تأكيدك: ${code} — أعطه للمزود لإتمام العمل. صالح 30 دقيقة.`,
        type:     "confirm_job",
        screen:   "/(client)/jobs",
        metadata: { job_id, code },
      });

    const inbox = !inboxErr;

    // ── 2. Attempt push notification if token available ───────
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
      title: "رمز تأكيد إنجاز العمل 🔑",
      body:  `رمز تأكيدك: ${code} — أعطه للمزود لإتمام العمل`,
      data:  { job_id, code, type: "confirm_job" },
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
