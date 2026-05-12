// ─────────────────────────────────────────────────────────────────────────────
// notify-admin — Waseet admin notification dispatcher
// Deno runtime
//
// Handles ALL admin email/SMS notifications in one place.
//
// Events (DB triggers → immediate):
//   cliq_payment          → SMS + Email
//   urgent_ticket         → SMS + Email
//   abuse_report_critical → Email
//   provider_flag_new     → Email
//   cancellation_abuse    → Email
//
// Events (pg_cron → scheduled):
//   urgent_no_bids   → Email  (every 30 min)
//   normal_tickets   → Email  (every 1 h)
//   reports_batch    → Email  (every 2 h)
//   daily_digest     → Email  (daily 08:00 Amman = 05:00 UTC)
//
// Required secrets (Supabase Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY     — from resend.com
//   ADMIN_EMAIL        — admin's email address
//   ADMIN_PHONE        — admin's mobile in 00962 format (for SMS)
//   ADMIN_FROM_EMAIL   — verified Resend sender (e.g. noreply@waseet.jo)
//   ADMIN_PORTAL_URL   — admin portal URL (e.g. https://admin.waseet.jo)
//   UNIFONIC_APP_SID   — already set (reused from send-otp)
// ─────────────────────────────────────────────────────────────────────────────

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ── Constants ─────────────────────────────────────────────────────────────────

const RESEND_URL      = "https://api.resend.com/emails";
const UNIFONIC_URL    = "https://el.cloud.unifonic.com/rest/SMS/messages";

const RESEND_KEY      = Deno.env.get("RESEND_API_KEY")    ?? "";
const ADMIN_EMAIL     = Deno.env.get("ADMIN_EMAIL")       ?? "";
const ADMIN_PHONE     = Deno.env.get("ADMIN_PHONE")       ?? "";
const FROM_EMAIL      = Deno.env.get("ADMIN_FROM_EMAIL")  ?? "onboarding@resend.dev";
const PORTAL_URL      = Deno.env.get("ADMIN_PORTAL_URL")  ?? "https://admin.waseet.jo";
const UNIFONIC_SID    = Deno.env.get("UNIFONIC_APP_SID")  ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

// ── Supabase admin client ──────────────────────────────────────────────────────

function makeAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

// ── Email helper ──────────────────────────────────────────────────────────────

function buildHtml(
  emoji:   string,
  title:   string,
  rows:    { label: string; value: string }[],
  pageUrl: string,
  badge?:  { text: string; color: string },
): string {
  const badgeHtml = badge
    ? `<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;
         font-weight:bold;background:${badge.color};color:#fff;margin-bottom:10px">${badge.text}</span><br>`
    : "";

  const rowsHtml = rows
    .map(
      (r) => `
      <div style="margin-bottom:12px">
        <div style="color:#7c3aed;font-size:11px;text-transform:uppercase;letter-spacing:.06em">${r.label}</div>
        <div style="color:#e2d9f3;font-size:14px;margin-top:3px">${r.value}</div>
      </div>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#06040f;margin:0;padding:20px">
  <div style="background:#0c091d;border-radius:12px;padding:28px;max-width:520px;
       margin:0 auto;border-top:4px solid #7c3aed">
    <div style="font-size:28px;margin-bottom:8px">${emoji}</div>
    ${badgeHtml}
    <h2 style="color:#ede9ff;font-size:18px;margin:0 0 20px;line-height:1.4">${title}</h2>
    ${rowsHtml}
    <a href="${pageUrl}"
       style="display:inline-block;background:#7c3aed;color:#fff;padding:11px 24px;
              border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;font-size:14px">
      افتح البوابة ←
    </a>
    <div style="margin-top:20px;padding-top:14px;border-top:1px solid #1e1547;
         text-align:center;color:#4c1d95;font-size:11px">
      وسيط — نظام الإشعارات الآلي
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(subject: string, html: string): Promise<void> {
  if (!RESEND_KEY || !ADMIN_EMAIL) {
    console.warn("[notify-admin] RESEND_API_KEY or ADMIN_EMAIL not configured — skipping email");
    return;
  }
  try {
    const res = await fetch(RESEND_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({ from: FROM_EMAIL, to: ADMIN_EMAIL, subject, html }),
    });
    if (!res.ok) console.error("[notify-admin] Resend error:", res.status, await res.text());
  } catch (err) {
    console.error("[notify-admin] sendEmail error:", err);
  }
}

// ── SMS helper ────────────────────────────────────────────────────────────────

async function sendSms(body: string): Promise<void> {
  if (!UNIFONIC_SID || !ADMIN_PHONE) {
    console.warn("[notify-admin] UNIFONIC_APP_SID or ADMIN_PHONE not configured — skipping SMS");
    return;
  }
  try {
    const form = new URLSearchParams({
      AppSid:       UNIFONIC_SID,
      Recipient:    ADMIN_PHONE,
      Body:         body,
      SenderID:     "Waseet",
      responseType: "JSON",
    });
    const res = await fetch(UNIFONIC_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    form.toString(),
    });
    if (!res.ok) console.error("[notify-admin] Unifonic error:", res.status, await res.text());
  } catch (err) {
    console.error("[notify-admin] sendSms error:", err);
  }
}

// ── Event handlers ────────────────────────────────────────────────────────────

// 1 — CliQ payment request (SMS + Email)
async function handleCliqPayment(data: any, db: ReturnType<typeof makeAdmin>) {
  const { data: user } = await db
    .from("users").select("full_name, phone").eq("id", data.user_id).maybeSingle();

  const name   = user?.full_name ?? "—";
  const phone  = user?.phone     ?? "—";
  const plan   = data.plan_tier  ?? "—";
  const amount = data.amount_jod ?? "—";
  const link   = `${PORTAL_URL}/support/${data.ticket_id}`;

  await Promise.all([
    sendEmail(
      `💳 طلب دفع CliQ جديد — ${plan} (${amount} د.أ)`,
      buildHtml("💳", `طلب دفع CliQ — ${plan}`, [
        { label: "المزود",    value: name },
        { label: "الهاتف",   value: phone },
        { label: "الباقة",   value: plan },
        { label: "المبلغ",   value: `${amount} دينار أردني` },
        { label: "رقم التذكرة", value: data.ticket_id?.slice(0, 8).toUpperCase() ?? "—" },
      ], link, { text: "يحتاج إجراء فوري", color: "#dc2626" }),
    ),
    sendSms(`وسيط 💳: طلب CliQ من ${name} — باقة ${plan} (${amount} د.أ). افتح البوابة الآن.`),
  ]);
}

// 2 — Urgent support ticket (SMS + Email)
async function handleUrgentTicket(data: any, db: ReturnType<typeof makeAdmin>) {
  const { data: user } = await db
    .from("users").select("full_name, phone, role").eq("id", data.user_id).maybeSingle();

  const name    = user?.full_name ?? "—";
  const phone   = user?.phone     ?? "—";
  const role    = user?.role === "provider" ? "مزود" : "عميل";
  const link    = `${PORTAL_URL}/support/${data.ticket_id}`;

  await Promise.all([
    sendEmail(
      `🚨 تذكرة دعم طارئة — ${data.subject ?? "بدون عنوان"}`,
      buildHtml("🚨", data.subject ?? "تذكرة دعم طارئة", [
        { label: "المستخدم", value: `${name} (${role})` },
        { label: "الهاتف",  value: phone },
        { label: "الفئة",   value: data.category ?? "—" },
        { label: "رقم التذكرة", value: data.ticket_id?.slice(0, 8).toUpperCase() ?? "—" },
      ], link, { text: "طارئ", color: "#dc2626" }),
    ),
    sendSms(`وسيط 🚨: تذكرة طارئة من ${name} — "${(data.subject ?? "").slice(0, 40)}". افتح البوابة الآن.`),
  ]);
}

// 3 — Critical abuse report: abusive / no_show (Email)
async function handleAbuseReportCritical(data: any, db: ReturnType<typeof makeAdmin>) {
  const [{ data: reporter }, { data: reported }] = await Promise.all([
    db.from("users").select("full_name, phone").eq("id", data.reporter_id).maybeSingle(),
    db.from("users").select("full_name, phone, role").eq("id", data.reported_user_id).maybeSingle(),
  ]);

  const typeLabel = data.report_type === "abusive" ? "محتوى مسيء" : "عدم حضور";
  const link = `${PORTAL_URL}/abuse-reports`;

  await sendEmail(
    `🚩 بلاغ ${typeLabel} جديد — ${reported?.full_name ?? "—"}`,
    buildHtml("🚩", `بلاغ جديد: ${typeLabel}`, [
      { label: "المُبلَّغ عنه", value: `${reported?.full_name ?? "—"} (${reported?.phone ?? "—"})` },
      { label: "دور المُبلَّغ عنه", value: reported?.role === "provider" ? "مزود" : "عميل" },
      { label: "مقدم البلاغ",  value: reporter?.full_name ?? "—" },
      { label: "الوصف",        value: data.description ?? "—" },
    ], link, { text: typeLabel, color: "#b91c1c" }),
  );
}

// 4 — New provider flag (Email)
async function handleProviderFlagNew(data: any, db: ReturnType<typeof makeAdmin>) {
  const { data: prov } = await db
    .from("providers")
    .select("user:users(full_name, phone)")
    .eq("id", data.provider_id)
    .maybeSingle();

  const user = (prov as any)?.user;
  const name  = user?.full_name ?? "—";
  const phone = user?.phone     ?? "—";

  const reasonLabel: Record<string, string> = {
    low_rating:      "تقييم منخفض",
    high_rejection:  "نسبة رفض عالية",
    complaints:      "بلاغات متعددة",
    job_abandonment: "هجر مهمة",
  };

  const details  = data.details ?? {};
  const detailRows = Object.entries(details).map(([k, v]) => ({ label: k, value: String(v) }));

  await sendEmail(
    `⚠️ علم جديد على مزود — ${reasonLabel[data.reason] ?? data.reason}`,
    buildHtml("⚠️", `علم جديد: ${reasonLabel[data.reason] ?? data.reason}`, [
      { label: "المزود",  value: name },
      { label: "الهاتف", value: phone },
      { label: "السبب",  value: reasonLabel[data.reason] ?? data.reason },
      ...detailRows,
    ], `${PORTAL_URL}/provider-flags`, { text: "يحتاج مراجعة", color: "#d97706" }),
  );
}

// 5 — Cancellation abuse (Email)
async function handleCancellationAbuse(data: any, db: ReturnType<typeof makeAdmin>) {
  const { data: user } = await db
    .from("users").select("full_name, phone").eq("id", data.user_id).maybeSingle();

  const meta  = data.metadata ?? {};
  const name  = user?.full_name ?? meta.user_id ?? "—";
  const phone = user?.phone     ?? "—";

  await sendEmail(
    `⛔ تنبيه إلغاءات متكررة — ${name}`,
    buildHtml("⛔", "مستخدم تجاوز حد الإلغاءات", [
      { label: "المستخدم",    value: name },
      { label: "الهاتف",     value: phone },
      { label: "عدد الإلغاءات", value: `${meta.count ?? "—"} هذا الشهر` },
      { label: "الشهر",       value: meta.month ?? "—" },
    ], `${PORTAL_URL}/cancellations`, { text: "3 إلغاءات / شهر", color: "#ea580c" }),
  );
}

// 6 — Urgent requests without bids after 2h (Email, cron every 30min)
async function handleUrgentNoBids(db: ReturnType<typeof makeAdmin>) {
  const { data: rows } = await db
    .from("requests")
    .select("id, title, city, category_slug, created_at, client_id, admin_urgency_notified_at")
    .eq("status",    "open")
    .eq("is_urgent", true)
    .lt("created_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .is("admin_urgency_notified_at", null);

  if (!rows || rows.length === 0) return;

  // Filter: no bids yet
  const withNoBids: typeof rows = [];
  for (const r of rows) {
    const { count } = await db
      .from("bids").select("id", { count: "exact", head: true }).eq("request_id", r.id);
    if ((count ?? 0) === 0) withNoBids.push(r);
  }
  if (withNoBids.length === 0) return;

  // Build table rows for email
  const tableRows = withNoBids
    .map((r) => `<tr>
      <td style="padding:8px;color:#e2d9f3;border-bottom:1px solid #1e1547">${r.title}</td>
      <td style="padding:8px;color:#a78bfa;border-bottom:1px solid #1e1547">${r.city ?? "—"}</td>
      <td style="padding:8px;color:#fbbf24;border-bottom:1px solid #1e1547">
        ${Math.floor((Date.now() - new Date(r.created_at).getTime()) / 3600000)}h
      </td>
    </tr>`)
    .join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#06040f;margin:0;padding:20px">
  <div style="background:#0c091d;border-radius:12px;padding:28px;max-width:560px;
       margin:0 auto;border-top:4px solid #7c3aed">
    <div style="font-size:28px;margin-bottom:8px">🔔</div>
    <span style="background:#92400e;color:#fbbf24;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:bold">
      يحتاج تدخلاً
    </span>
    <h2 style="color:#ede9ff;font-size:18px;margin:10px 0 16px">
      ${withNoBids.length} طلب طارئ بدون عروض منذ أكثر من ساعتين
    </h2>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#1e1547">
          <th style="padding:8px;color:#7c3aed;text-align:right;font-size:12px">الطلب</th>
          <th style="padding:8px;color:#7c3aed;text-align:right;font-size:12px">المدينة</th>
          <th style="padding:8px;color:#7c3aed;text-align:right;font-size:12px">منذ</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <a href="${PORTAL_URL}/requests?status=open"
       style="display:inline-block;background:#7c3aed;color:#fff;padding:11px 24px;
              border-radius:8px;text-decoration:none;font-weight:bold;margin-top:20px;font-size:14px">
      افتح البوابة ←
    </a>
    <div style="margin-top:20px;padding-top:14px;border-top:1px solid #1e1547;
         text-align:center;color:#4c1d95;font-size:11px">
      وسيط — نظام الإشعارات الآلي
    </div>
  </div>
</body>
</html>`;

  await sendEmail(`🔔 ${withNoBids.length} طلب طارئ بدون عروض منذ +2 ساعة`, html);

  // Mark as notified
  const ids = withNoBids.map((r) => r.id);
  await db.from("requests")
    .update({ admin_urgency_notified_at: new Date().toISOString() })
    .in("id", ids);
}

// 7 — Normal support tickets (Email, cron every 1h)
async function handleNormalTickets(db: ReturnType<typeof makeAdmin>) {
  const { data: tickets } = await db
    .from("support_tickets")
    .select("id, subject, category, opened_at, user_id, admin_notified_at")
    .eq("priority", "normal")
    .eq("status",   "open")
    .neq("category", "payment")
    .is("admin_notified_at", null)
    .order("opened_at", { ascending: true });

  if (!tickets || tickets.length === 0) return;

  // Enrich with user names
  const userIds = [...new Set(tickets.map((t: any) => t.user_id).filter(Boolean))];
  const { data: users } = await db.from("users").select("id, full_name").in("id", userIds);
  const userMap = Object.fromEntries((users ?? []).map((u: any) => [u.id, u.full_name]));

  const catLabel: Record<string, string> = {
    order: "طلبات", provider: "مزود خدمة",
    account: "حساب", contract: "عقد دوري", other: "أخرى",
  };

  const tableRows = tickets
    .map((t: any) => `<tr>
      <td style="padding:8px;color:#e2d9f3;border-bottom:1px solid #1e1547">
        ${userMap[t.user_id] ?? "—"}
      </td>
      <td style="padding:8px;color:#a78bfa;border-bottom:1px solid #1e1547">${t.subject}</td>
      <td style="padding:8px;color:#6d28d9;border-bottom:1px solid #1e1547;font-size:12px">
        ${catLabel[t.category] ?? t.category}
      </td>
    </tr>`)
    .join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#06040f;margin:0;padding:20px">
  <div style="background:#0c091d;border-radius:12px;padding:28px;max-width:560px;
       margin:0 auto;border-top:4px solid #7c3aed">
    <div style="font-size:28px;margin-bottom:8px">📋</div>
    <h2 style="color:#ede9ff;font-size:18px;margin:0 0 16px">
      ${tickets.length} تذكرة دعم جديدة تنتظر ردك
    </h2>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#1e1547">
          <th style="padding:8px;color:#7c3aed;text-align:right;font-size:12px">المستخدم</th>
          <th style="padding:8px;color:#7c3aed;text-align:right;font-size:12px">الموضوع</th>
          <th style="padding:8px;color:#7c3aed;text-align:right;font-size:12px">الفئة</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <a href="${PORTAL_URL}/support"
       style="display:inline-block;background:#7c3aed;color:#fff;padding:11px 24px;
              border-radius:8px;text-decoration:none;font-weight:bold;margin-top:20px;font-size:14px">
      افتح الدعم الفني ←
    </a>
    <div style="margin-top:20px;padding-top:14px;border-top:1px solid #1e1547;
         text-align:center;color:#4c1d95;font-size:11px">
      وسيط — نظام الإشعارات الآلي
    </div>
  </div>
</body>
</html>`;

  await sendEmail(`📋 ${tickets.length} تذكرة دعم جديدة`, html);

  const ids = tickets.map((t: any) => t.id);
  await db.from("support_tickets")
    .update({ admin_notified_at: new Date().toISOString() })
    .in("id", ids);
}

// 8 — Non-critical reports batch: spam / fake_bid / other (Email, cron every 2h)
async function handleReportsBatch(db: ReturnType<typeof makeAdmin>) {
  const { data: reports } = await db
    .from("reports")
    .select(`
      id, report_type, description, created_at,
      reporter:users!reports_reporter_id_fkey(full_name),
      reported:users!reports_reported_user_id_fkey(full_name, phone)
    `)
    .in("report_type", ["spam", "fake_bid", "other"])
    .eq("status", "pending")
    .is("admin_notified_at", null)
    .order("created_at", { ascending: true });

  if (!reports || reports.length === 0) return;

  const typeLabel: Record<string, string> = {
    spam:     "رسائل مزعجة",
    fake_bid: "عرض وهمي",
    other:    "أخرى",
  };

  const tableRows = reports
    .map((r: any) => `<tr>
      <td style="padding:8px;color:#e2d9f3;border-bottom:1px solid #1e1547">
        ${r.reported?.full_name ?? "—"}
      </td>
      <td style="padding:8px;color:#a78bfa;border-bottom:1px solid #1e1547;font-size:12px">
        ${typeLabel[r.report_type] ?? r.report_type}
      </td>
      <td style="padding:8px;color:#6b7280;border-bottom:1px solid #1e1547;font-size:12px">
        ${r.reporter?.full_name ?? "—"}
      </td>
    </tr>`)
    .join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#06040f;margin:0;padding:20px">
  <div style="background:#0c091d;border-radius:12px;padding:28px;max-width:560px;
       margin:0 auto;border-top:4px solid #7c3aed">
    <div style="font-size:28px;margin-bottom:8px">🚩</div>
    <h2 style="color:#ede9ff;font-size:18px;margin:0 0 16px">
      ${reports.length} بلاغ جديد يستحق المراجعة
    </h2>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#1e1547">
          <th style="padding:8px;color:#7c3aed;text-align:right;font-size:12px">المُبلَّغ عنه</th>
          <th style="padding:8px;color:#7c3aed;text-align:right;font-size:12px">النوع</th>
          <th style="padding:8px;color:#7c3aed;text-align:right;font-size:12px">مقدم البلاغ</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
    <a href="${PORTAL_URL}/abuse-reports"
       style="display:inline-block;background:#7c3aed;color:#fff;padding:11px 24px;
              border-radius:8px;text-decoration:none;font-weight:bold;margin-top:20px;font-size:14px">
      افتح البلاغات ←
    </a>
    <div style="margin-top:20px;padding-top:14px;border-top:1px solid #1e1547;
         text-align:center;color:#4c1d95;font-size:11px">
      وسيط — نظام الإشعارات الآلي
    </div>
  </div>
</body>
</html>`;

  await sendEmail(`🚩 ${reports.length} بلاغ جديد يستحق المراجعة`, html);

  const ids = reports.map((r: any) => r.id);
  await db.from("reports")
    .update({ admin_notified_at: new Date().toISOString() })
    .in("id", ids);
}

// 9 — Daily digest (Email, cron 05:00 UTC = 08:00 Amman)
async function handleDailyDigest(db: ReturnType<typeof makeAdmin>) {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: newClients },
    { count: newProviders },
    { count: newRequests },
    { count: completedJobs },
    { count: openTickets },
    { count: unreviewedFlags },
    { count: pendingReports },
    { count: pendingSuggestions },
    { count: urgentNoBids },
  ] = await Promise.all([
    db.from("users").select("id", { count: "exact", head: true })
      .eq("role", "client").gte("created_at", yesterday),
    db.from("users").select("id", { count: "exact", head: true })
      .eq("role", "provider").gte("created_at", yesterday),
    db.from("requests").select("id", { count: "exact", head: true })
      .gte("created_at", yesterday),
    db.from("jobs").select("id", { count: "exact", head: true })
      .eq("status", "completed").gte("updated_at", yesterday),
    db.from("support_tickets").select("id", { count: "exact", head: true })
      .eq("status", "open"),
    db.from("provider_flags").select("id", { count: "exact", head: true })
      .eq("reviewed", false),
    db.from("reports").select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    db.from("service_suggestions").select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    db.from("requests").select("id", { count: "exact", head: true })
      .eq("status", "open").eq("is_urgent", true),
  ]);

  const today = new Date().toLocaleDateString("ar-JO", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  function statRow(emoji: string, label: string, value: number, alert = false): string {
    const color = alert && value > 0 ? "#f87171" : "#a78bfa";
    return `<tr>
      <td style="padding:10px 8px;color:#9ca3af;font-size:13px;border-bottom:1px solid #1e1547">
        ${emoji} ${label}
      </td>
      <td style="padding:10px 8px;color:${color};font-size:16px;font-weight:bold;
           text-align:left;border-bottom:1px solid #1e1547">${value}</td>
    </tr>`;
  }

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#06040f;margin:0;padding:20px">
  <div style="background:#0c091d;border-radius:12px;padding:28px;max-width:520px;
       margin:0 auto;border-top:4px solid #7c3aed">
    <div style="font-size:28px;margin-bottom:8px">📊</div>
    <h2 style="color:#ede9ff;font-size:18px;margin:0 0 4px">ملخص وسيط اليومي</h2>
    <div style="color:#6d28d9;font-size:12px;margin-bottom:20px">${today}</div>

    <div style="color:#7c3aed;font-size:11px;text-transform:uppercase;
         letter-spacing:.08em;margin-bottom:8px">النشاط — آخر 24 ساعة</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      ${statRow("👤", "عملاء جدد",          newClients   ?? 0)}
      ${statRow("🔧", "مزودون جدد",         newProviders ?? 0)}
      ${statRow("📋", "طلبات جديدة",        newRequests  ?? 0)}
      ${statRow("✅", "مهام مكتملة",        completedJobs ?? 0)}
    </table>

    <div style="color:#7c3aed;font-size:11px;text-transform:uppercase;
         letter-spacing:.08em;margin-bottom:8px">يحتاج انتباهاً</div>
    <table style="width:100%;border-collapse:collapse">
      ${statRow("💳", "تذاكر دعم مفتوحة",   openTickets       ?? 0, true)}
      ${statRow("⚠️", "أعلام مزودين معلقة", unreviewedFlags   ?? 0, true)}
      ${statRow("🚩", "بلاغات معلقة",       pendingReports    ?? 0, true)}
      ${statRow("💡", "اقتراحات معلقة",     pendingSuggestions ?? 0)}
      ${statRow("🚨", "طلبات طارئة نشطة",   urgentNoBids      ?? 0, true)}
    </table>

    <a href="${PORTAL_URL}"
       style="display:inline-block;background:#7c3aed;color:#fff;padding:11px 24px;
              border-radius:8px;text-decoration:none;font-weight:bold;margin-top:24px;font-size:14px">
      افتح البوابة ←
    </a>
    <div style="margin-top:20px;padding-top:14px;border-top:1px solid #1e1547;
         text-align:center;color:#4c1d95;font-size:11px">
      وسيط — ملخص يومي آلي
    </div>
  </div>
</body>
</html>`;

  await sendEmail(`📊 ملخص وسيط — ${today}`, html);
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { event, data } = await req.json();
    const db = makeAdmin();

    switch (event) {
      case "cliq_payment":           await handleCliqPayment(data, db);            break;
      case "urgent_ticket":          await handleUrgentTicket(data, db);           break;
      case "abuse_report_critical":  await handleAbuseReportCritical(data, db);    break;
      case "provider_flag_new":      await handleProviderFlagNew(data, db);        break;
      case "cancellation_abuse":     await handleCancellationAbuse(data, db);      break;
      case "urgent_no_bids":         await handleUrgentNoBids(db);                 break;
      case "normal_tickets":         await handleNormalTickets(db);                break;
      case "reports_batch":          await handleReportsBatch(db);                 break;
      case "daily_digest":           await handleDailyDigest(db);                  break;
      default:
        return json({ error: `unknown event: ${event}` }, 400);
    }

    return json({ ok: true, event });
  } catch (err) {
    console.error("[notify-admin] unhandled error:", err);
    return json({ error: String(err) }, 500);
  }
});
