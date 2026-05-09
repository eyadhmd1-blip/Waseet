// ============================================================
// WASEET — send-delayed-commit-notifications
// Scheduled Deno Edge Function — called every minute by pg_cron.
//
// Finds jobs where the client's grace period has expired
// (provider_notif_due_at <= NOW, status = 'active', not yet sent)
// and sends the "bid accepted" push notification to the provider.
//
// By delaying the notification until after the grace period, we avoid
// the false-positive case where the client cancels within 60 s but the
// provider has already received a commit request.
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

function buildCopy(
  lang: string,
  isUrgent: boolean,
  reqTitle: string,
  amount: unknown,
  currency: string,
  minutes: number,
) {
  if (lang === "en") {
    const title = isUrgent
      ? "🚨 Client accepted your bid — urgent!"
      : "✅ Client accepted your bid!";
    const body = isUrgent
      ? `${reqTitle} · ${amount} ${currency} +20% urgent — confirm within ${minutes} min`
      : `${reqTitle} · ${amount} ${currency} — confirm within ${minutes} min`;
    return { title, body };
  }
  const title = isUrgent
    ? "🚨 قبِل عميل عرضك — طلب طارئ!"
    : "✅ قبِل عميل عرضك!";
  const body = isUrgent
    ? `${reqTitle} · ${amount} ${currency} +20% طارئ — أكّد خلال ${minutes} دقائق`
    : `${reqTitle} · ${amount} ${currency} — أكّد خلال ${minutes} دقيقة`;
  return { title, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Find all jobs whose grace period has passed and notification not yet sent
    const { data: dueJobs, error: fetchErr } = await admin
      .from("jobs")
      .select(`
        id, provider_id, provider_commit_deadline,
        request:requests ( title, is_urgent ),
        bid:bids ( amount, currency )
      `)
      .eq("status", "active")
      .eq("provider_notif_sent", false)
      .lte("provider_notif_due_at", new Date().toISOString())
      .not("provider_notif_due_at", "is", null)
      .limit(50);

    if (fetchErr) return json({ error: fetchErr.message }, 500);
    if (!dueJobs || dueJobs.length === 0) return json({ processed: 0 });

    let sent = 0;
    let skipped = 0;

    for (const job of dueJobs as any[]) {
      try {
        // Mark as sent first to prevent double-sends even if push fails
        await admin
          .from("jobs")
          .update({ provider_notif_sent: true })
          .eq("id", job.id);

        const [{ data: tokenRow }, { data: providerUser }] = await Promise.all([
          admin
            .from("push_tokens")
            .select("token")
            .eq("user_id", job.provider_id)
            .maybeSingle(),
          admin
            .from("users")
            .select("lang")
            .eq("id", job.provider_id)
            .maybeSingle(),
        ]);

        if (!tokenRow?.token) {
          skipped++;
          continue;
        }

        const lang = providerUser?.lang ?? "ar";
        const isUrgent = !!job.request?.is_urgent;
        const reqTitle = job.request?.title ?? "";
        const bidAmount = job.bid?.amount ?? "";
        const bidCurrency = job.bid?.currency ?? "JOD";

        const deadline = job.provider_commit_deadline
          ? new Date(job.provider_commit_deadline)
          : null;
        const minutesLeft = deadline
          ? Math.max(1, Math.round((deadline.getTime() - Date.now()) / 60000))
          : isUrgent
          ? 5
          : 15;

        const { title, body } = buildCopy(
          lang,
          isUrgent,
          reqTitle,
          bidAmount,
          bidCurrency,
          minutesLeft,
        );

        const message = {
          to: tokenRow.token,
          title,
          body,
          sound: "default",
          priority: "high",
          ttl: minutesLeft * 60,
          data: {
            screen: "provider_confirm",
            job_id: job.id,
            is_urgent: isUrgent,
            notif_id: `job_commit_${job.id}`,
          },
          channelId: isUrgent ? "urgent" : "default",
        };

        await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(message),
        });

        await admin
          .from("notifications")
          .insert({
            user_id: job.provider_id,
            title,
            body,
            type: "job_commit_request",
            screen: "provider_confirm",
            metadata: { job_id: job.id, is_urgent: isUrgent },
          })
          .then(() => {})
          .catch(() => {});

        sent++;
      } catch (err) {
        console.error(`[delayed-commit] job ${job.id}:`, err);
      }
    }

    return json({ processed: dueJobs.length, sent, skipped });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
