// ============================================================
// WASEET — send-demo-request Edge Function
//
// Runs every 5 minutes via Supabase cron schedule.
// Finds new providers whose 1-hour window has passed,
// sends an Expo push notification, then marks them as notified.
//
// Schedule registration (run once via CLI):
//   supabase functions deploy send-demo-request --schedule "*/5 * * * *"
//
// Manual trigger:
//   curl -X POST https://<project>.supabase.co/functions/v1/send-demo-request \
//     -H "Authorization: Bearer <service_role_key>"
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

Deno.serve(async (req) => {
  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // 1. Fetch providers who are ready for their demo notification
  const { data: pending, error: fetchErr } = await supabase
    .rpc("get_pending_demo_notifications");

  if (fetchErr) {
    console.error("[Demo] fetch error:", fetchErr);
    return json({ error: fetchErr.message }, 500);
  }

  if (!pending || pending.length === 0) {
    return json({ ok: true, sent: 0 });
  }

  console.log(`[Demo] sending to ${pending.length} providers`);

  // 2. Build Expo push messages
  const messages = pending.map((row: { provider_id: string; token: string; full_name: string }) => ({
    to:    row.token,
    title: "طلبك التجريبي جاهز! 🎯",
    body:  "قدّم عرضك الأول وتعرّف على طريقة عمل المنصة 👋",
    data:  { screen: "demo", provider_id: row.provider_id },
    sound: "default",
    badge: 1,
  }));

  // 3. Send to Expo push service (batch of up to 100)
  let sent = 0;
  const BATCH = 100;

  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(batch),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`[Demo] Expo error ${res.status}: ${text}`);
        continue;
      }

      sent += batch.length;
    } catch (err) {
      console.error("[Demo] fetch error:", err);
    }
  }

  // 4. Mark all as notified (even if push failed — avoid retry spam)
  for (const row of pending) {
    await supabase.rpc("mark_demo_notification_sent", {
      p_provider_id: row.provider_id,
    });
  }

  console.log(`[Demo] done. sent=${sent} total=${pending.length}`);
  return json({ ok: true, sent, total: pending.length });
});
