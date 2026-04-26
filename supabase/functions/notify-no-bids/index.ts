// ============================================================
// WASEET — notify-no-bids
// Scheduled edge function — runs every 30 minutes.
// Sends a push notification to clients whose requests have
// been open for 6+ hours with zero bids.
//
// Schedule (Supabase Dashboard → Edge Functions → Schedule):
//   Cron: */30 * * * *
//
// Flow:
//   1. Call flag_clients_no_bids() RPC — atomically marks
//      requests and returns the list to notify.
//   2. For each request, look up client push token.
//   3. Fetch AI price suggestion for the category.
//   4. Send push via Expo Push API.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // ── Step 1: atomically flag + fetch requests to notify ────
    const { data: toNotify, error: rpcErr } = await admin.rpc(
      "flag_clients_no_bids"
    );

    if (rpcErr) return json({ error: rpcErr.message }, 500);
    if (!toNotify || toNotify.length === 0)
      return json({ sent: 0, reason: "no_requests_to_notify" });

    const results: { request_id: string; sent: boolean; reason?: string }[] =
      [];

    for (const row of toNotify as {
      request_id: string;
      client_id: string;
      request_title: string;
    }[]) {
      // ── Step 2: get client push token ──────────────────────
      const { data: tokenRow } = await admin
        .from("push_tokens")
        .select("token")
        .eq("user_id", row.client_id)
        .maybeSingle();

      if (!tokenRow?.token) {
        results.push({ request_id: row.request_id, sent: false, reason: "no_token" });
        continue;
      }

      // ── Step 3: insert in-app notification ─────────────────
      await admin.from("notifications").insert({
        user_id:    row.client_id,
        title:      "طلبك لم يصله أي عرض بعد",
        body:       `${row.request_title} — قد يساعد تعديل الميزانية على جذب المزودين`,
        screen:     "my_requests",
        metadata:   { request_id: row.request_id, type: "no_bids_reminder" },
      });

      // ── Step 4: send push via Expo ─────────────────────────
      const message = {
        to:       tokenRow.token,
        title:    "طلبك لم يصله أي عرض بعد",
        body:     `${row.request_title} — اضغط لإعادة النشر أو تعديل الميزانية`,
        sound:    "default",
        priority: "normal",
        data: {
          screen:     "my_requests",
          request_id: row.request_id,
          type:       "no_bids_reminder",
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

      results.push({ request_id: row.request_id, sent });
    }

    const sentCount = results.filter((r) => r.sent).length;
    return json({ sent: sentCount, total: results.length, results });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
