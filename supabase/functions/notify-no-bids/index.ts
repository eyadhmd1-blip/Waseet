// ============================================================
// WASEET — notify-no-bids
// Scheduled edge function — runs every 30 minutes.
// Sends a push notification to clients whose requests have
// been open for 6+ hours with zero bids.
// Notification language matches the client's preferred language.
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
      title: "Your request has no bids yet",
      body:  `${reqTitle} — consider adjusting the budget to attract providers`,
    };
  }
  return {
    title: "طلبك لم يصله أي عرض بعد",
    body:  `${reqTitle} — قد يساعد تعديل الميزانية على جذب المزودين`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: toNotify, error: rpcErr } = await admin.rpc("flag_clients_no_bids");

    if (rpcErr) return json({ error: rpcErr.message }, 500);
    if (!toNotify || toNotify.length === 0) {
      return json({ sent: 0, reason: "no_requests_to_notify" });
    }

    // Batch fetch client languages
    const clientIds = [...new Set((toNotify as any[]).map((r) => r.client_id))];
    const { data: langRows } = await admin
      .from("users")
      .select("id, lang")
      .in("id", clientIds);
    const langMap = new Map((langRows ?? []).map((u: { id: string; lang: string }) => [u.id, u.lang]));

    const results: { request_id: string; sent: boolean; reason?: string }[] = [];

    for (const row of toNotify as { request_id: string; client_id: string; request_title: string }[]) {
      const { data: tokenRow } = await admin
        .from("push_tokens")
        .select("token")
        .eq("user_id", row.client_id)
        .maybeSingle();

      if (!tokenRow?.token) {
        results.push({ request_id: row.request_id, sent: false, reason: "no_token" });
        continue;
      }

      const lang = langMap.get(row.client_id) ?? "ar";
      const { title, body } = buildCopy(lang, row.request_title);

      await admin.from("notifications").insert({
        user_id:  row.client_id,
        title,
        body,
        screen:   "my_requests",
        metadata: { request_id: row.request_id, type: "no_bids_reminder" },
      });

      const message = {
        to:       tokenRow.token,
        title,
        body,
        sound:    "default",
        priority: "high",
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
      results.push({ request_id: row.request_id, sent: expoData?.data?.status === "ok" });
    }

    return json({ sent: results.filter((r) => r.sent).length, total: results.length, results });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
