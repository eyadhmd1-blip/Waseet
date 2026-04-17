// ============================================================
// WASEET — Smart Notification Engine  (scale edition)
// Supabase Edge Function (Deno runtime)
//
// At 1M users this function is called by notification-dispatcher,
// NOT directly by cron. Dispatcher fans out N parallel invocations
// each covering a batch of BATCH_SIZE users. Direct cron invocation
// is still supported for single-user testing and dry runs.
//
// Scale changes vs. original:
//   1. Reads user_segments_cache (materialised table) instead of
//      the user_segments view — eliminates O(n²) correlated subqueries.
//   2. Accepts batch_offset + batch_size for paginated processing.
//   3. Pre-fetches weekly notification counts in ONE bulk query
//      instead of one query per user in the hot loop.
//
// ENV vars:
//   SUPABASE_URL              — auto-injected
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected
//   ANTHROPIC_API_KEY         — for AI copy generation (optional)
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ─── Types ────────────────────────────────────────────────────

interface UserSegment {
  user_id: string;
  city: string;
  segment: "new" | "active" | "dormant" | "churned";
  top_category: string | null;
  days_since_last_notif: number | null;
  total_requests: number;
  last_request_at: string | null;
  created_at_user: string;   // renamed from created_at in cache table
}

interface PushToken {
  user_id: string;
  token: string;
}

interface NotificationPayload {
  user_id: string;
  notification_type: string;
  template_key: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  ab_variant?: string;
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  badge?: number;
  ttl?: number;
  priority?: "default" | "normal" | "high";
}

// ─── Constants ────────────────────────────────────────────────

const JORDAN_TZ_OFFSET = 3; // UTC+3

const SEASONAL_WINDOWS = {
  ramadan_prep:  { month: 2,  day_start: 15, day_end: 28 },
  summer_start:  { month: 5,  day_start: 1,  day_end: 10 },
  summer_peak:   { month: 7,  day_start: 1,  day_end: 15 },
  back_to_school:{ month: 8,  day_start: 20, day_end: 31 },
  winter_prep:   { month: 11, day_start: 1,  day_end: 15 },
  new_year:      { month: 12, day_start: 20, day_end: 31 },
  eid_ul_fitr:   { month: 3,  day_start: 28, day_end: 31 },
};

const COOLDOWN_DAYS: Record<string, number> = {
  new:     3,
  active:  7,
  dormant: 10,
  churned: 14,
};

// ─── Expo Push Sender ─────────────────────────────────────────

async function sendExpoBatch(
  messages: Array<ExpoMessage & { user_id: string; payload: NotificationPayload }>,
  supabase: SupabaseClient,
  dryRun: boolean,
): Promise<{ sent: number; failed: number }> {
  if (dryRun || messages.length === 0) {
    console.log(`[DRY RUN] Would send ${messages.length} notifications`);
    return { sent: 0, failed: 0 };
  }

  const EXPO_BATCH = 100;
  let sent = 0, failed = 0;

  for (let i = 0; i < messages.length; i += EXPO_BATCH) {
    const batch = messages.slice(i, i + EXPO_BATCH);
    const expoMessages = batch.map(({ user_id: _u, payload: _p, ...msg }) => msg);

    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(expoMessages),
      });

      const result  = await res.json();
      const tickets = Array.isArray(result?.data) ? result.data : [];

      const logRows = batch.map((msg, idx) => ({
        user_id:           msg.user_id,
        notification_type: msg.payload.notification_type,
        template_key:      msg.payload.template_key,
        title:             msg.payload.title,
        body:              msg.payload.body,
        data:              msg.payload.data,
        ab_variant:        msg.payload.ab_variant ?? null,
        expo_ticket_id:    tickets[idx]?.id ?? null,
      }));

      await supabase.from("notification_log").insert(logRows);

      const batchSent = tickets.filter((t: { status?: string }) => t?.status === "ok").length;
      sent   += batchSent;
      failed += batch.length - batchSent;

    } catch (err) {
      console.error("Expo batch error:", err);
      failed += batch.length;
    }
  }

  return { sent, failed };
}

// ─── AI Copy Generator ────────────────────────────────────────

async function generateAICopy(
  segment: UserSegment,
  templateKey: string,
  fallbackTitle: string,
  fallbackBody: string,
): Promise<{ title: string; body: string }> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return { title: fallbackTitle, body: fallbackBody };

  try {
    const prompt = `أنت كاتب إشعارات احترافي لتطبيق خدمات محلية أردني اسمه "وسيط".

اكتب إشعاراً موجزاً للمستخدم التالي:
- مدينته: ${segment.city}
- شريحته: ${segment.segment}
- آخر خدمة استخدمها: ${segment.top_category ?? "غير محدد"}
- نوع الإشعار: ${templateKey}

المتطلبات:
- العنوان: ≤ 40 حرفاً، جذاب وشخصي
- النص: ≤ 80 حرفاً، واضح، يحتوي على call-to-action
- أسلوب عامّي أردني دافئ، لا رسمي مبالغ فيه
- لا تبدأ بـ "وسيط:" في العنوان

أجب بـ JSON فقط: { "title": "...", "body": "..." }`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data  = await res.json();
    const text  = data?.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.title && parsed.body) return parsed;
    }
  } catch { /* fall through */ }

  return { title: fallbackTitle, body: fallbackBody };
}

// ─── Template Library ─────────────────────────────────────────

function getSeasonalTemplate(
  now: Date,
  segment: UserSegment,
): { key: string; title: string; body: string; data: Record<string, unknown> } | null {
  const m = now.getMonth() + 1;
  const d = now.getDate();

  const inWindow = (w: { month: number; day_start: number; day_end: number }) =>
    m === w.month && d >= w.day_start && d <= w.day_end;

  if (inWindow(SEASONAL_WINDOWS.ramadan_prep)) {
    return {
      key:  "ramadan_prep",
      title: "🌙 جهّز بيتك لرمضان",
      body:  "دهان وتنظيف شامل — احجز مزوّدك قبل الازدحام",
      data:  { category: "cleaning", screen: "new-request" },
    };
  }
  if (inWindow(SEASONAL_WINDOWS.winter_prep)) {
    const acUser = segment.top_category === "ac_repair";
    return {
      key:  "winter_ac",
      title: acUser ? "❄️ كيّفك بحاجة صيانة شتوية؟" : "❄️ الشتاء قادم — جهّز بيتك",
      body:  acUser
        ? "صيانة وقائية الآن أرخص من الإصلاح في أشد الأيام برودة"
        : "سخّانات، تمديدات، عزل — كل خدمات الشتاء في وسيط",
      data:  { category: acUser ? "ac_repair" : "electrical", screen: "new-request" },
    };
  }
  if (inWindow(SEASONAL_WINDOWS.summer_start)) {
    return {
      key:  "summer_ac",
      title: "☀️ موسم الحر قادم",
      body:  "جهّز التكييف قبل الازدحام — مزودون موثّقون يستجيبون خلال ساعة",
      data:  { category: "ac_repair", screen: "new-request" },
    };
  }
  if (inWindow(SEASONAL_WINDOWS.back_to_school)) {
    return {
      key:  "back_to_school",
      title: "📚 العودة للمدارس — جهّز الغرف",
      body:  "دهان، نجارة، كهرباء — حضّر غرفة الأولاد قبل الدراسة",
      data:  { category: "painting", screen: "new-request" },
    };
  }
  if (inWindow(SEASONAL_WINDOWS.new_year)) {
    return {
      key:  "new_year",
      title: "🎉 أكمل مشاريعك قبل العام الجديد",
      body:  "لا تنقل قائمة أعمالك للعام القادم — المزودون جاهزون",
      data:  { screen: "new-request" },
    };
  }

  return null;
}

function getLifecycleTemplate(
  segment: UserSegment,
): { key: string; title: string; body: string; data: Record<string, unknown> } | null {
  const daysSinceRegister = (Date.now() - new Date(segment.created_at_user).getTime()) / 86400000;
  const daysSinceRequest  = segment.last_request_at
    ? (Date.now() - new Date(segment.last_request_at).getTime()) / 86400000
    : null;

  if (segment.segment === "new" && daysSinceRegister >= 3 && segment.total_requests === 0) {
    return {
      key:  "new_user_nudge",
      title: "👋 أهلاً في وسيط — ابدأ أول طلبك",
      body:  "آلاف المزودين الموثّقين ينتظرون — انشر طلبك مجاناً الآن",
      data:  { screen: "new-request" },
    };
  }

  if (segment.segment === "active" && daysSinceRequest && daysSinceRequest >= 28 && daysSinceRequest <= 35) {
    const cat = segment.top_category;
    const catAr: Record<string, string> = {
      plumbing: "السباكة", electrical: "الكهرباء",
      ac_repair: "التكييف", cleaning: "التنظيف",
      painting: "الدهان", carpentry: "النجارة",
    };
    const catName = cat ? (catAr[cat] ?? "الخدمات") : "الخدمات";
    return {
      key:  "post_job_30d",
      title: "🔄 هل بقي شيء في قائمتك؟",
      body:  `مزودو ${catName} الموثّقون في ${segment.city} جاهزون لك`,
      data:  { category: cat ?? undefined, screen: "new-request" },
    };
  }

  if (segment.segment === "dormant" && daysSinceRequest && daysSinceRequest >= 30 && daysSinceRequest <= 37) {
    return {
      key:  "dormant_reengagement",
      title: "👀 وسيط اشتاق لك",
      body:  "مزودون جدد موثّقون في منطقتك — تعال تحقق",
      data:  { screen: "home" },
    };
  }

  return null;
}

function getBehavioralTemplate(
  segment: UserSegment,
): { key: string; title: string; body: string; data: Record<string, unknown> } | null {
  if (segment.segment === "churned") {
    const daysSinceRegister = (Date.now() - new Date(segment.created_at_user).getTime()) / 86400000;
    if (daysSinceRegister < 120) {
      return {
        key:  "win_back",
        title: "🎁 عرض خاص — عدنا لك",
        body:  "انشر طلبك الآن وسنعطيك أولوية في عروض المزودين",
        data:  { screen: "new-request", promo: "win_back" },
      };
    }
  }

  if (segment.segment === "dormant" && Number(segment.days_since_last_notif) > 20) {
    return {
      key:  "social_proof",
      title: "📈 ١٢٠+ خدمة أُنجزت هذا الأسبوع",
      body:  `مزودون موثّقون في ${segment.city} يستجيبون خلال ساعة`,
      data:  { screen: "home" },
    };
  }

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────

function getNotifType(key: string): string {
  if (["ramadan_prep", "winter_ac", "summer_ac", "back_to_school", "new_year"].includes(key)) return "seasonal";
  if (["new_user_nudge", "post_job_30d", "dormant_reengagement"].includes(key)) return "lifecycle";
  if (["win_back"].includes(key)) return "win_back";
  return "behavioral";
}

// ─── Main Handler ─────────────────────────────────────────────

Deno.serve(async (req) => {
  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // ── Parse request options ─────────────────────────────────────
  let dryRun       = false;
  let targetUserId: string | null = null;
  let useAI        = false;
  let batchOffset  = 0;
  let batchSize    = 0;  // 0 = no pagination (fetch all, for direct/test calls)

  try {
    const body  = await req.json().catch(() => ({}));
    dryRun       = body.dry_run       === true;
    targetUserId = body.user_id       ?? null;
    useAI        = body.use_ai        === true;
    batchOffset  = body.batch_offset  ?? 0;
    batchSize    = body.batch_size    ?? 0;
  } catch { /* no body */ }

  const now  = new Date(Date.now() + JORDAN_TZ_OFFSET * 3_600_000);
  const hour = now.getUTCHours();

  console.log(
    `[Engine] Jordan time: ${now.toISOString()} | ` +
    `offset=${batchOffset} size=${batchSize} dryRun=${dryRun} useAI=${useAI}`
  );

  // ── Step 1: Fetch user segments from materialised CACHE ───────
  // O(1) per row — indexed table scan, no correlated subqueries.
  let segQuery = supabase
    .from("user_segments_cache")
    .select("*");

  if (targetUserId) {
    segQuery = segQuery.eq("user_id", targetUserId);
  } else if (batchSize > 0) {
    // Paginated batch from dispatcher
    segQuery = segQuery.range(batchOffset, batchOffset + batchSize - 1);
  }
  // else: fetch all (direct invocation / dry run over full set)

  const { data: segments, error: segErr } = await segQuery;

  if (segErr) {
    console.error("Segments error:", segErr);
    return json({ error: segErr.message }, 500);
  }

  const userIds = (segments ?? []).map((s: UserSegment) => s.user_id);

  if (userIds.length === 0) {
    return json({ ok: true, segments_fetched: 0, queue_size: 0, sent: 0, failed: 0 });
  }

  // ── Step 2: Fetch push tokens for this batch ──────────────────
  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("user_id, token")
    .in("user_id", userIds);

  const tokenMap = new Map<string, string>(
    (tokens ?? []).map((t: PushToken) => [t.user_id, t.token]),
  );

  // ── Step 3: Fetch notification preferences for this batch ─────
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("*")
    .in("user_id", userIds);

  const prefsMap = new Map(
    (prefs ?? []).map((p: { user_id: string } & Record<string, unknown>) => [p.user_id, p]),
  );

  // ── Step 4: Pre-fetch weekly notification counts — ONE QUERY ──
  // BEFORE (original): one SELECT COUNT per user inside the loop.
  //   → N queries, where N = batch size. Catastrophic at scale.
  //
  // AFTER: single IN-query for all users in this batch.
  //   → 1 query regardless of batch size.
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const { data: weekCountRows } = await supabase
    .from("notification_log")
    .select("user_id")
    .in("user_id", userIds)
    .gte("sent_at", weekAgo);

  // Build user_id → count map
  const weekCountMap = new Map<string, number>();
  for (const row of weekCountRows ?? []) {
    const uid = (row as { user_id: string }).user_id;
    weekCountMap.set(uid, (weekCountMap.get(uid) ?? 0) + 1);
  }

  // ── Step 5: Build notification queue ─────────────────────────
  const queue: Array<ExpoMessage & { user_id: string; payload: NotificationPayload }> = [];

  for (const seg of (segments ?? []) as UserSegment[]) {
    const token = tokenMap.get(seg.user_id);
    if (!token) continue;

    const pref = prefsMap.get(seg.user_id) as Record<string, unknown> | undefined;
    if (pref?.enabled === false) continue;

    // Quiet hours check (Jordan local time)
    const quietStart = (pref?.quiet_hour_start as number) ?? 22;
    const quietEnd   = (pref?.quiet_hour_end   as number) ?? 8;
    if (quietEnd < quietStart) {
      if (hour >= quietStart || hour < quietEnd) continue;
    } else {
      if (hour >= quietStart && hour < quietEnd) continue;
    }

    // Spam guard — per-segment cooldown
    const cooldown = COOLDOWN_DAYS[seg.segment] ?? 7;
    if (seg.days_since_last_notif !== null && seg.days_since_last_notif < cooldown) continue;

    // Max per week guard — uses pre-fetched map (zero DB calls here)
    const maxPerWeek = (pref?.max_per_week as number) ?? 2;
    if ((weekCountMap.get(seg.user_id) ?? 0) >= maxPerWeek) continue;

    // Template selection (priority order)
    const template =
      ((pref?.seasonal  !== false) ? getSeasonalTemplate(now, seg)   : null) ??
      ((pref?.lifecycle !== false) ? getLifecycleTemplate(seg)        : null) ??
      ((pref?.behavioral !== false || pref?.win_back !== false) ? getBehavioralTemplate(seg) : null);

    if (!template) continue;

    // A/B variant (50/50 for lifecycle templates)
    const abVariant = template.key.startsWith("post_job") || template.key === "dormant_reengagement"
      ? (Math.random() < 0.5 ? "A" : "B")
      : undefined;

    // Phase 3: AI copy (dormant/churned only, for cost control)
    let finalTitle = template.title;
    let finalBody  = template.body;

    if (useAI && (seg.segment === "dormant" || seg.segment === "churned")) {
      const aiCopy = await generateAICopy(seg, template.key, template.title, template.body);
      finalTitle   = aiCopy.title;
      finalBody    = aiCopy.body;
    }

    // B variant: shorter copy
    if (abVariant === "B") {
      finalTitle = finalTitle.replace(/^[^\s]+ /, "");
      finalBody  = finalBody.split(" — ")[0];
    }

    const payload: NotificationPayload = {
      user_id:           seg.user_id,
      notification_type: getNotifType(template.key),
      template_key:      template.key,
      title:             finalTitle,
      body:              finalBody,
      data:              { ...template.data, notif_id: crypto.randomUUID() },
      ab_variant:        abVariant,
    };

    queue.push({
      to:       token,
      title:    finalTitle,
      body:     finalBody,
      sound:    "default",
      data:     payload.data,
      ttl:      86400,
      priority: "high",
      user_id:  seg.user_id,
      payload,
    });
  }

  console.log(`[Engine] batch=${batchOffset}-${batchOffset + userIds.length} queue=${queue.length}`);

  // ── Step 6: Send ──────────────────────────────────────────────
  const { sent, failed } = await sendExpoBatch(queue, supabase, dryRun);

  return json({
    ok:               true,
    dry_run:          dryRun,
    batch_offset:     batchOffset,
    segments_fetched: segments?.length ?? 0,
    queue_size:       queue.length,
    sent,
    failed,
    jordan_hour:      hour,
  });
});
