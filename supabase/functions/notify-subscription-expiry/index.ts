// ============================================================
// WASEET — notify-subscription-expiry
// Daily cron (recommended: 05:00 UTC = 08:00 Jordan UTC+3).
// Scans all subscribed providers for:
//   1. Subscription expiring in ~3 days  (warning)
//   2. Subscription expiring in ~1 day   (urgent warning)
//   3. Low bid credits (1–3 remaining)
//   4. Zero bid credits
//   5. Trial ended (not subscribed, trial used)
//   6. Subscription already expired      (M-5: "subscription_expired")
// Sends targeted push notifications in each provider's language.
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE    = 50;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

type NotifType =
  | "expiring3" | "expiring1"
  | "lowCredits" | "noCredits"
  | "trialEnded" | "subscriptionExpired";

function buildCopy(lang: string, type: NotifType, bonusCredits = 0): { title: string; body: string } {
  if (lang === "en") {
    switch (type) {
      case "expiring3":
        return { title: "⏰ Your subscription expires in 3 days", body: "Renew now to keep receiving requests" };
      case "expiring1":
        return { title: "🚨 Your subscription expires tomorrow", body: "Don't miss requests — renew now" };
      case "lowCredits":
        return { title: "⚠️ Your credits are almost out", body: "3 or fewer credits left — renew your subscription soon" };
      case "noCredits":
        return {
          title: "🔴 No subscription credits left",
          body: `You can't submit bids now — renew to continue${bonusCredits > 0 ? ` · ${bonusCredits} bonus credits waiting 🏆` : ""}`,
        };
      case "trialEnded":
        return { title: "🎁 Your trial has ended", body: "Subscribe now to keep receiving client requests and bidding" };
      case "subscriptionExpired":
        return { title: "🔴 Your subscription has expired", body: "Renew now to appear in results and submit bids" };
    }
  }
  // Arabic (default)
  switch (type) {
    case "expiring3":
      return { title: "⏰ اشتراكك ينتهي بعد 3 أيام", body: "جدّد اشتراكك الآن للاستمرار في استقبال الطلبات" };
    case "expiring1":
      return { title: "🚨 اشتراكك ينتهي غداً", body: "لا تفوّت الطلبات — جدّد اشتراكك الآن" };
    case "lowCredits":
      return { title: "⚠️ رصيدك على وشك النفاد", body: "تبقّى لديك 3 أرصدة أو أقل — جدّد اشتراكك قريباً" };
    case "noCredits":
      return {
        title: "🔴 نفد رصيد اشتراكك",
        body: `لا يمكنك تقديم عروض الآن — جدّد للاستمرار${bonusCredits > 0 ? ` — ${bonusCredits} رصيد مكافأة بانتظارك 🏆` : ""}`,
      };
    case "trialEnded":
      return { title: "🎁 انتهت فترتك التجريبية", body: "اشترك الآن لتواصل تلقّي طلبات العملاء والمزايدة عليها" };
    case "subscriptionExpired":
      return { title: "🔴 انتهى اشتراكك", body: "جدّد الآن للظهور في النتائج وتقديم العروض" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const now     = new Date();
    const in1Day  = new Date(now.getTime() + 1  * 24 * 60 * 60 * 1000);
    const in2Days = new Date(now.getTime() + 2  * 24 * 60 * 60 * 1000);
    const in3Days = new Date(now.getTime() + 3  * 24 * 60 * 60 * 1000);
    const ago1Day = new Date(now.getTime() - 1  * 24 * 60 * 60 * 1000);

    const [
      { data: expiring3 },
      { data: expiring1 },
      { data: lowCredits },
      { data: noCredits },
      { data: trialEnded },
      { data: justExpired },
    ] = await Promise.all([
      // Expiring in 3 days
      admin.from("providers").select("id").eq("is_subscribed", true)
        .gte("subscription_ends", in2Days.toISOString()).lte("subscription_ends", in3Days.toISOString()),
      // Expiring in 1 day
      admin.from("providers").select("id").eq("is_subscribed", true)
        .gte("subscription_ends", now.toISOString()).lte("subscription_ends", in1Day.toISOString()),
      // Low credits (1–3)
      admin.from("providers").select("id").eq("is_subscribed", true)
        .neq("subscription_tier", "premium").gte("subscription_credits", 1).lte("subscription_credits", 3),
      // Zero credits
      admin.from("providers").select("id, bonus_credits").eq("is_subscribed", true)
        .neq("subscription_tier", "premium").eq("subscription_credits", 0),
      // Trial ended
      admin.from("providers").select("id").eq("is_subscribed", false).eq("trial_used", true),
      // Subscription expired in the past 24h (M-5)
      admin.from("providers").select("id").eq("is_subscribed", false)
        .gte("subscription_ends", ago1Day.toISOString()).lt("subscription_ends", now.toISOString())
        .neq("subscription_tier", "trial"),
    ]);

    type QueueItem = { provider_id: string; type: NotifType; bonus_credits?: number };
    const queue: QueueItem[] = [];

    for (const p of expiring3      ?? []) queue.push({ provider_id: p.id, type: "expiring3" });
    for (const p of expiring1      ?? []) queue.push({ provider_id: p.id, type: "expiring1" });
    for (const p of lowCredits     ?? []) queue.push({ provider_id: p.id, type: "lowCredits" });
    for (const p of noCredits      ?? []) queue.push({ provider_id: p.id, type: "noCredits", bonus_credits: p.bonus_credits ?? 0 });
    for (const p of trialEnded     ?? []) queue.push({ provider_id: p.id, type: "trialEnded" });
    for (const p of justExpired    ?? []) queue.push({ provider_id: p.id, type: "subscriptionExpired" });

    if (queue.length === 0) return json({ sent: 0, total: 0 });

    const providerIds = [...new Set(queue.map((q) => q.provider_id))];

    const [{ data: tokens }, { data: langRows }] = await Promise.all([
      admin.from("push_tokens").select("user_id, token").in("user_id", providerIds),
      admin.from("users").select("id, lang").in("id", providerIds),
    ]);

    const tokenMap = new Map((tokens ?? []).map((t: { user_id: string; token: string }) => [t.user_id, t.token]));
    const langMap  = new Map((langRows ?? []).map((u: { id: string; lang: string }) => [u.id, u.lang]));

    const messages = queue
      .filter((q) => tokenMap.has(q.provider_id))
      .map((q) => {
        const lang = langMap.get(q.provider_id) ?? "ar";
        const { title, body } = buildCopy(lang, q.type, q.bonus_credits);
        return {
          to:        tokenMap.get(q.provider_id)!,
          title,
          body,
          sound:     "default",
          priority:  "high",
          data:      { screen: "subscribe", type: q.type },
          channelId: "default",
        };
      });

    // Also insert in-app notifications for subscription_expired
    const expiredInbox = (queue)
      .filter((q) => q.type === "subscriptionExpired" && langMap.has(q.provider_id))
      .map((q) => {
        const lang = langMap.get(q.provider_id) ?? "ar";
        const { title, body } = buildCopy(lang, "subscriptionExpired");
        return {
          user_id:  q.provider_id,
          title,
          body,
          type:     "subscription_expired",
          screen:   "subscribe",
          metadata: {},
        };
      });

    if (expiredInbox.length > 0) {
      await admin.from("notifications").insert(expiredInbox).then(() => {}).catch(() => {});
    }

    let sent = 0;
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const res = await fetch(EXPO_PUSH_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body:    JSON.stringify(batch),
      });
      if (res.ok) sent += batch.length;
    }

    return json({ sent, total: queue.length });

  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
