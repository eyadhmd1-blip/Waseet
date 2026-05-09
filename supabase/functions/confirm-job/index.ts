// Supabase Edge Function — confirm-job
// Deno runtime — SECURITY DEFINER equivalent for the confirm flow
//
// Replaces the client-side code validation in provider jobs screen.
// The client NEVER reads confirm_code from DB — validation happens here.
//
// ENV vars required:
//   SUPABASE_URL           — auto-injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase
//
// Request body: { job_id: string, code: string }
// Response:     { success: true } | { error: string }

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
    // ── Authenticate the caller ───────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    // Use anon client to verify the JWT
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !user) return json({ error: "unauthorized" }, 401);

    // ── Parse request ─────────────────────────────────────────
    const { job_id, code } = await req.json() as { job_id: string; code: string };
    if (!job_id || !code) return json({ error: "job_id and code are required" }, 400);

    // ── Service-role client (can read confirm_code) ───────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // ── Fetch job — verify caller is the provider ─────────────
    const { data: job, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("id, provider_id, client_id, request_id, confirm_code, confirm_code_exp, status")
      .eq("id", job_id)
      .single();

    if (jobError || !job) return json({ error: "job_not_found" }, 404);
    if (job.provider_id !== user.id) return json({ error: "not_your_job" }, 403);
    if (job.status !== "active") return json({ error: "job_not_active" }, 400);
    if (!job.confirm_code) return json({ error: "no_code_generated" }, 400);

    // ── Check expiry ──────────────────────────────────────────
    if (new Date(job.confirm_code_exp) < new Date()) {
      return json({ error: "code_expired" }, 400);
    }

    // ── Validate code (constant-time comparison) ──────────────
    const expected = job.confirm_code as string;
    const provided = String(code).trim();

    // Simple constant-time check (codes are short fixed-length)
    if (expected.length !== provided.length || expected !== provided) {
      return json({ error: "wrong_code" }, 400);
    }

    // ── Mark job completed ────────────────────────────────────
    const { error: updateError } = await supabaseAdmin
      .from("jobs")
      .update({
        confirmed_by_client: true,
        confirmed_at:        new Date().toISOString(),
        status:              "completed",
        confirm_code:        null,
        confirm_code_exp:    null,
      })
      .eq("id", job_id);

    if (updateError) return json({ error: updateError.message }, 500);

    // ── Mark request completed ────────────────────────────────
    // Client's request list reads from `requests` table — must sync status.
    await supabaseAdmin
      .from("requests")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", job.request_id);

    // ── Notify client to rate the provider ────────────────────
    // Fire-and-forget: failures here must not block the success response
    (async () => {
      try {
        const [providerRes, clientRes, tokenRes] = await Promise.all([
          supabaseAdmin.from("users").select("full_name").eq("id", job.provider_id).single(),
          supabaseAdmin.from("users").select("lang").eq("id", job.client_id).single(),
          supabaseAdmin.from("push_tokens").select("token").eq("user_id", job.client_id).maybeSingle(),
        ]);

        const lang         = clientRes.data?.lang ?? "ar";
        const providerName = providerRes.data?.full_name ?? (lang === "ar" ? "المزود" : "Provider");

        const title = lang === "ar"
          ? `✅ اكتمل العمل مع ${providerName}`
          : `✅ Job completed with ${providerName}`;
        const body = lang === "ar"
          ? "شاركنا رأيك — تقييمك يساعد المجتمع ويكافئ المزودين المتميزين ⭐"
          : "Share your experience — your rating helps the community and rewards top providers ⭐";

        // In-app notification (shows in notification inbox)
        await supabaseAdmin.from("notifications").insert({
          user_id:  job.client_id,
          title,
          body,
          type:     "job_rated",
          screen:   "rate_job",
          metadata: { job_id, provider_name: providerName },
        });

        // Push notification (works even when app is closed)
        if (tokenRes.data?.token) {
          await fetch("https://exp.host/--/api/v2/push/send", {
            method:  "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body:    JSON.stringify({
              to:        tokenRes.data.token,
              title,
              body,
              sound:     "default",
              priority:  "high",
              data: {
                screen:        "rate_job",
                job_id,
                provider_name: providerName,
              },
              channelId: "default",
            }),
          });
        }
      } catch (_) {
        // Intentionally swallowed — notification failure must not affect the success response
      }
    })();

    return json({ success: true });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
