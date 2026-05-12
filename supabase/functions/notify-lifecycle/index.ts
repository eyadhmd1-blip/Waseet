// ============================================================
// WASEET — notify-lifecycle Edge Function
// Called daily at 06:00 UTC by pg_cron.
//
// Handles 5 lifecycle automation events:
//   1. bid_reminder       — new provider, 0 bids after 48h
//   2. client_onboarding  — new client, 0 requests after 24h
//   3. rating_reminder    — completed job, no rating after 24h
//   4. portfolio_reminder — new provider, 0 portfolio items after 7d
//   5. reengagement       — any user inactive ≥21 days
//
// Each handler: marks rows as sent (at-most-once) → sends Expo
// push → inserts in-app notification in the notifications table.
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 50;

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

function makeAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}

type DB = ReturnType<typeof makeAdmin>;

// ── Shared helpers ─────────────────────────────────────────────

async function sendPushBatch(messages: object[]): Promise<void> {
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages.slice(i, i + BATCH_SIZE)),
    }).catch(() => {});
  }
}

async function insertInApp(
  db: DB,
  rows: Array<{
    user_id: string;
    title: string;
    body: string;
    type: string;
    screen: string;
    metadata?: object;
  }>
): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    await db
      .from("notifications")
      .insert(rows.slice(i, i + 500))
      .catch(() => {});
  }
}

function pushMsg(
  token: string,
  title: string,
  body: string,
  data: object
): object {
  return { to: token, title, body, data, sound: "default", priority: "normal", channelId: "default" };
}

// ── Copy builders ──────────────────────────────────────────────

function bidReminderCopy(lang: string) {
  return lang === "en"
    ? {
        title: "💼 Submit your first bid!",
        body: "Browse open requests in your area and start earning today.",
      }
    : {
        title: "💼 قدّم عرضك الأول!",
        body: "تصفّح الطلبات المتاحة في منطقتك وابدأ بالكسب اليوم.",
      };
}

function clientOnboardingCopy(lang: string) {
  return lang === "en"
    ? {
        title: "🔧 Post your first request!",
        body: "Describe what you need and get offers from trusted providers.",
      }
    : {
        title: "🔧 أنشئ طلبك الأول!",
        body: "صف ما تحتاجه واحصل على عروض من مزودين موثوقين.",
      };
}

function ratingReminderCopy(lang: string) {
  return lang === "en"
    ? {
        title: "⭐ Rate your provider",
        body: "How was your experience? Your rating helps the community.",
      }
    : {
        title: "⭐ قيّم مزوّد الخدمة",
        body: "كيف كانت تجربتك؟ تقييمك يساعد الجميع على الاختيار.",
      };
}

function portfolioReminderCopy(lang: string) {
  return lang === "en"
    ? {
        title: "📸 Add your work samples",
        body: "Providers with portfolios win 3× more bids. Add yours now!",
      }
    : {
        title: "📸 أضف نماذج من أعمالك",
        body: "المزودون الذين لديهم بورتفوليو يفوزون بعروض أكثر بـ 3 أضعاف. أضفها الآن!",
      };
}

function reengagementCopy(lang: string, role: string) {
  if (lang === "en") {
    return role === "provider"
      ? {
          title: "👋 New requests are waiting!",
          body: "Clients are looking for providers like you. Don't miss out.",
        }
      : {
          title: "👋 Need a service? We're here!",
          body: "Post a request and get offers from trusted professionals.",
        };
  }
  return role === "provider"
    ? {
        title: "👋 طلبات جديدة بانتظارك!",
        body: "العملاء يبحثون عن مزودين مثلك. لا تفوّت الفرصة.",
      }
    : {
        title: "👋 تحتاج خدمة؟ نحن هنا!",
        body: "أنشئ طلباً واحصل على عروض من محترفين موثوقين.",
      };
}

// ── Event handlers ─────────────────────────────────────────────

async function handleBidReminder(db: DB): Promise<number> {
  const { data: rows, error } = await db.rpc("_lc_bid_reminder_targets");
  if (error || !rows?.length) return 0;

  const now = new Date().toISOString();
  const ids: string[] = rows.map((r: { provider_id: string }) => r.provider_id);

  await db.from("providers").update({ bid_reminder_sent_at: now }).in("id", ids);

  const pushMessages = rows
    .filter((r: { token: string | null }) => r.token)
    .map((r: { provider_id: string; lang: string; token: string }) => {
      const { title, body } = bidReminderCopy(r.lang);
      return pushMsg(r.token, title, body, { screen: "providerFeed", notif_type: "bid_reminder" });
    });

  const inAppRows = rows.map((r: { provider_id: string; lang: string }) => {
    const { title, body } = bidReminderCopy(r.lang);
    return { user_id: r.provider_id, title, body, type: "lifecycle_bid_reminder", screen: "providerFeed" };
  });

  await Promise.all([sendPushBatch(pushMessages), insertInApp(db, inAppRows)]);
  return rows.length;
}

async function handleClientOnboarding(db: DB): Promise<number> {
  const { data: rows, error } = await db.rpc("_lc_client_onboarding_targets");
  if (error || !rows?.length) return 0;

  const now = new Date().toISOString();
  const ids: string[] = rows.map((r: { user_id: string }) => r.user_id);

  await db.from("users").update({ client_onboarding_sent_at: now }).in("id", ids);

  const pushMessages = rows
    .filter((r: { token: string | null }) => r.token)
    .map((r: { user_id: string; lang: string; token: string }) => {
      const { title, body } = clientOnboardingCopy(r.lang);
      return pushMsg(r.token, title, body, { screen: "newRequest", notif_type: "client_onboarding" });
    });

  const inAppRows = rows.map((r: { user_id: string; lang: string }) => {
    const { title, body } = clientOnboardingCopy(r.lang);
    return { user_id: r.user_id, title, body, type: "lifecycle_client_onboarding", screen: "newRequest" };
  });

  await Promise.all([sendPushBatch(pushMessages), insertInApp(db, inAppRows)]);
  return rows.length;
}

async function handleRatingReminder(db: DB): Promise<number> {
  const { data: rows, error } = await db.rpc("_lc_rating_reminder_targets");
  if (error || !rows?.length) return 0;

  const now = new Date().toISOString();
  const jobIds: string[] = rows.map((r: { job_id: string }) => r.job_id);

  await db.from("jobs").update({ rating_reminder_sent_at: now }).in("id", jobIds);

  const pushMessages = rows
    .filter((r: { token: string | null }) => r.token)
    .map((r: { client_id: string; job_id: string; lang: string; token: string }) => {
      const { title, body } = ratingReminderCopy(r.lang);
      return pushMsg(r.token, title, body, { screen: "jobDetail", job_id: r.job_id, notif_type: "rating_reminder" });
    });

  const inAppRows = rows.map((r: { client_id: string; job_id: string; lang: string }) => {
    const { title, body } = ratingReminderCopy(r.lang);
    return {
      user_id: r.client_id,
      title,
      body,
      type: "lifecycle_rating_reminder",
      screen: "jobDetail",
      metadata: { job_id: r.job_id },
    };
  });

  await Promise.all([sendPushBatch(pushMessages), insertInApp(db, inAppRows)]);
  return rows.length;
}

async function handlePortfolioReminder(db: DB): Promise<number> {
  const { data: rows, error } = await db.rpc("_lc_portfolio_reminder_targets");
  if (error || !rows?.length) return 0;

  const now = new Date().toISOString();
  const ids: string[] = rows.map((r: { provider_id: string }) => r.provider_id);

  await db.from("providers").update({ portfolio_reminder_sent_at: now }).in("id", ids);

  const pushMessages = rows
    .filter((r: { token: string | null }) => r.token)
    .map((r: { provider_id: string; lang: string; token: string }) => {
      const { title, body } = portfolioReminderCopy(r.lang);
      return pushMsg(r.token, title, body, { screen: "providerProfile", notif_type: "portfolio_reminder" });
    });

  const inAppRows = rows.map((r: { provider_id: string; lang: string }) => {
    const { title, body } = portfolioReminderCopy(r.lang);
    return { user_id: r.provider_id, title, body, type: "lifecycle_portfolio_reminder", screen: "providerProfile" };
  });

  await Promise.all([sendPushBatch(pushMessages), insertInApp(db, inAppRows)]);
  return rows.length;
}

async function handleReengagement(db: DB): Promise<number> {
  const { data: rows, error } = await db.rpc("_lc_reengagement_targets");
  if (error || !rows?.length) return 0;

  const now = new Date().toISOString();
  const ids: string[] = rows.map((r: { user_id: string }) => r.user_id);

  await db.from("users").update({ reengagement_sent_at: now }).in("id", ids);

  const pushMessages = rows
    .filter((r: { token: string | null }) => r.token)
    .map((r: { user_id: string; lang: string; role: string; token: string }) => {
      const { title, body } = reengagementCopy(r.lang, r.role);
      return pushMsg(r.token, title, body, { screen: "home", notif_type: "reengagement" });
    });

  const inAppRows = rows.map((r: { user_id: string; lang: string; role: string }) => {
    const { title, body } = reengagementCopy(r.lang, r.role);
    return { user_id: r.user_id, title, body, type: "lifecycle_reengagement", screen: "home" };
  });

  await Promise.all([sendPushBatch(pushMessages), insertInApp(db, inAppRows)]);
  return rows.length;
}

// ── Main ───────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const db = makeAdmin();

    const results = await Promise.allSettled([
      handleBidReminder(db).then((n) => ({ event: "bid_reminder", sent: n })),
      handleClientOnboarding(db).then((n) => ({ event: "client_onboarding", sent: n })),
      handleRatingReminder(db).then((n) => ({ event: "rating_reminder", sent: n })),
      handlePortfolioReminder(db).then((n) => ({ event: "portfolio_reminder", sent: n })),
      handleReengagement(db).then((n) => ({ event: "reengagement", sent: n })),
    ]);

    const summary = results.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : { event: "error", reason: String((r as PromiseRejectedResult).reason) }
    );

    return json({ ok: true, results: summary });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
