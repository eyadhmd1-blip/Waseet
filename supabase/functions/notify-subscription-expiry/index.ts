// ============================================================
// WASEET — notify-subscription-expiry
// Daily cron (recommended: 05:00 UTC = 08:00 Jordan UTC+3).
// Scans all subscribed providers for:
//   1. Subscription expiring in ~3 days
//   2. Subscription expiring in ~1 day
//   3. Low bid credits (1–3 remaining)
//   4. Zero bid credits
// Sends targeted push notifications.
// ============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE    = 50;

serve(async () => {
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

    // ── 1. Expiring in 3 days (between now+2d and now+3d) ────
    const { data: expiring3 } = await admin
      .from("providers")
      .select("id")
      .eq("is_subscribed", true)
      .gte("subscription_ends", in2Days.toISOString())
      .lte("subscription_ends", in3Days.toISOString());

    // ── 2. Expiring in 1 day (between now and now+1d) ────────
    const { data: expiring1 } = await admin
      .from("providers")
      .select("id")
      .eq("is_subscribed", true)
      .gte("subscription_ends", now.toISOString())
      .lte("subscription_ends", in1Day.toISOString());

    // ── 3. Low subscription credits (1–3, not premium) ──────────
    const { data: lowCredits } = await admin
      .from("providers")
      .select("id")
      .eq("is_subscribed", true)
      .neq("subscription_tier", "premium")
      .gte("subscription_credits", 1)
      .lte("subscription_credits", 3);

    // ── 4. Zero subscription credits (not premium) ───────────────
    const { data: noCredits } = await admin
      .from("providers")
      .select("id, bonus_credits")
      .eq("is_subscribed", true)
      .neq("subscription_tier", "premium")
      .eq("subscription_credits", 0);

    // ── 5. Trial ended (not subscribed, trial was used) ──────────
    const { data: trialEnded } = await admin
      .from("providers")
      .select("id")
      .eq("is_subscribed", false)
      .eq("trial_used", true);

    // ── Build notification queue ──────────────────────────────
    type QueueItem = {
      provider_id: string;
      title:       string;
      body:        string;
      data:        object;
    };

    const queue: QueueItem[] = [];

    for (const p of expiring3 ?? []) {
      queue.push({
        provider_id: p.id,
        title: "⏰ اشتراكك ينتهي بعد 3 أيام",
        body:  "جدّد اشتراكك الآن للاستمرار في استقبال الطلبات",
        data:  { screen: "subscribe" },
      });
    }

    for (const p of expiring1 ?? []) {
      queue.push({
        provider_id: p.id,
        title: "🚨 اشتراكك ينتهي غداً",
        body:  "لا تفوّت الطلبات — جدّد اشتراكك الآن",
        data:  { screen: "subscribe" },
      });
    }

    for (const p of lowCredits ?? []) {
      queue.push({
        provider_id: p.id,
        title: "⚠️ رصيدك على وشك النفاد",
        body:  "تبقّى لديك 3 أرصدة أو أقل — جدّد اشتراكك قريباً",
        data:  { screen: "subscribe" },
      });
    }

    for (const p of noCredits ?? []) {
      const bonusMsg = (p.bonus_credits ?? 0) > 0
        ? ` — ${p.bonus_credits} رصيد مكافأة بانتظارك 🏆`
        : "";
      queue.push({
        provider_id: p.id,
        title: "🔴 نفد رصيد اشتراكك",
        body:  `لا يمكنك تقديم عروض الآن — جدّد للاستمرار${bonusMsg}`,
        data:  { screen: "subscribe" },
      });
    }

    for (const p of trialEnded ?? []) {
      queue.push({
        provider_id: p.id,
        title: "🎁 انتهت فترتك التجريبية",
        body:  "اشترك الآن لتواصل تلقّي طلبات العملاء والمزايدة عليها",
        data:  { screen: "subscribe" },
      });
    }

    if (queue.length === 0) {
      return new Response(JSON.stringify({ sent: 0, total: 0 }), { status: 200 });
    }

    // ── Fetch push tokens for all providers in queue ──────────
    const providerIds = [...new Set(queue.map((q) => q.provider_id))];
    const { data: tokens } = await admin
      .from("push_tokens")
      .select("user_id, token")
      .in("user_id", providerIds);

    const tokenMap = new Map((tokens ?? []).map((t) => [t.user_id, t.token]));

    // ── Build Expo messages ───────────────────────────────────
    const messages = queue
      .filter((q) => tokenMap.has(q.provider_id))
      .map((q) => ({
        to:        tokenMap.get(q.provider_id)!,
        title:     q.title,
        body:      q.body,
        sound:     "default",
        priority:  "high",
        data:      q.data,
        channelId: "default",
      }));

    // ── Send in batches ───────────────────────────────────────
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

    return new Response(
      JSON.stringify({ sent, total: queue.length }),
      { status: 200 }
    );

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
