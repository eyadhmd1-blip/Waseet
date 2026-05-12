import { supabaseAdmin } from '../lib/supabase';

export const dynamic = 'force-dynamic';

async function getCounts() {
  const now      = new Date().toISOString();
  const in7d     = new Date(Date.now() + 7  * 86_400_000).toISOString();
  const ago24h   = new Date(Date.now() -      86_400_000).toISOString();
  const ago30d   = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const results = await Promise.allSettled([
    /* 0  A-01 */ supabaseAdmin.from('providers').select('id', { count: 'exact', head: true }).eq('is_subscribed', true),
    /* 1  A-02 */ supabaseAdmin.from('providers').select('id', { count: 'exact', head: true }).eq('is_subscribed', false).not('subscription_ends', 'is', null).lt('subscription_ends', now),
    /* 2  A-03 */ supabaseAdmin.from('providers').select('id', { count: 'exact', head: true }).eq('is_subscribed', true).gte('subscription_ends', now).lte('subscription_ends', in7d),
    /* 3  A-04 */ supabaseAdmin.from('manual_payments').select('id', { count: 'exact', head: true }),
    /* 4  B-01 */ supabaseAdmin.from('requests').select('id', { count: 'exact', head: true }).gte('created_at', ago30d),
    /* 5  B-03 */ supabaseAdmin.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'open').lt('created_at', ago24h),
    /* 6  C-01 */ supabaseAdmin.from('providers').select('id', { count: 'exact', head: true }),
    /* 7  C-04 */ supabaseAdmin.from('providers').select('id', { count: 'exact', head: true }).eq('is_active', false),
    /* 8  C-03 */ supabaseAdmin.from('provider_flags').select('id', { count: 'exact', head: true }).eq('reviewed', false),
    /* 9  E-02 */ supabaseAdmin.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    /* 10 D-01 */ supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).gte('created_at', ago30d),
    /* 11 E-04 */ supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }).lte('client_rating', 2).not('client_rating', 'is', null),
    /* 12 E-01 */ supabaseAdmin.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'cancelled').gte('created_at', ago30d),
    /* 13 F-01 */ supabaseAdmin.from('admin_audit_log').select('id', { count: 'exact', head: true }),
  ]);

  const c = (i: number) =>
    results[i].status === 'fulfilled' ? ((results[i] as PromiseFulfilledResult<any>).value.count ?? 0) : 0;

  return {
    activeSubs:   c(0),
    expiredSubs:  c(1),
    expiringSoon: c(2),
    manualPmts:   c(3),
    requests30d:  c(4),
    openOld:      c(5),
    allProviders: c(6),
    suspended:    c(7),
    flagged:      c(8),
    pendingRpts:  c(9),
    newUsers30d:  c(10),
    lowRatings:   c(11),
    cancelled30d: c(12),
    auditCount:   c(13),
  };
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Report = {
  id:          string;
  code:        string;
  title:       string;
  desc:        string;
  count?:      number;
  countLabel?: string;
  urgent?:     boolean;
  noExport?:   boolean;
};

type Group = {
  key:     string;
  label:   string;
  color:   'amber' | 'blue' | 'emerald' | 'violet' | 'rose' | 'slate';
  reports: Report[];
};

// ── Color maps ────────────────────────────────────────────────────────────────

const BADGE: Record<string, string> = {
  amber:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  blue:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  violet:  'bg-violet-500/15 text-violet-400 border-violet-500/30',
  rose:    'bg-rose-500/15 text-rose-400 border-rose-500/30',
  slate:   'bg-slate-700/50 text-slate-400 border-slate-600',
};

const COUNT_CLR: Record<string, string> = {
  amber:   'text-amber-400',
  blue:    'text-blue-400',
  emerald: 'text-emerald-400',
  violet:  'text-violet-400',
  rose:    'text-rose-400',
  slate:   'text-slate-400',
};

const BTN: Record<string, string> = {
  amber:   'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20',
  blue:    'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20',
  violet:  'bg-violet-500/10 text-violet-400 border-violet-500/30 hover:bg-violet-500/20',
  rose:    'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20',
  slate:   'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ReportsPage() {
  const ct = await getCounts();

  const groups: Group[] = [
    {
      key: 'A', label: 'أ — المالية', color: 'amber',
      reports: [
        { id: 'a01', code: 'A-01', title: 'الاشتراكات النشطة',      desc: 'المقدمون المشتركون حالياً مع تاريخ انتهاء اشتراكهم والأداء',  count: ct.activeSubs,   countLabel: 'مشترك' },
        { id: 'a02', code: 'A-02', title: 'الاشتراكات المنتهية',    desc: 'مقدمون انتهت اشتراكاتهم ولم يجدّدوا بعد',                     count: ct.expiredSubs,  countLabel: 'منتهٍ' },
        { id: 'a03', code: 'A-03', title: 'تنتهي خلال 7 أيام',      desc: 'اشتراكات على وشك الانتهاء — تحتاج تواصلاً عاجلاً',           count: ct.expiringSoon, countLabel: 'اشتراك', urgent: ct.expiringSoon > 0 },
        { id: 'a04', code: 'A-04', title: 'تاريخ المدفوعات',         desc: 'كل عمليات الدفع اليدوي مع المبلغ وطريقة الدفع والمرجع',       count: ct.manualPmts,   countLabel: 'عملية' },
        { id: 'a05', code: 'A-05', title: 'الإيراد الشهري',          desc: 'مدفوعات الاشتراكات مجمّعة شهرياً — نظرة على نمو الإيراد' },
      ],
    },
    {
      key: 'B', label: 'ب — الطلبات والعمليات', color: 'blue',
      reports: [
        { id: 'b01', code: 'B-01', title: 'الطلبات حسب الحالة',          desc: 'آخر 30 يوم — open / in_progress / completed / cancelled',    count: ct.requests30d,  countLabel: 'طلب' },
        { id: 'b02', code: 'B-02', title: 'الطلبات حسب المدينة والفئة', desc: 'توزيع الطلبات على المدن والفئات مجمّعة (آخر 30 يوم)' },
        { id: 'b03', code: 'B-03', title: 'طلبات بلا عروض (+24 ساعة)',   desc: 'طلبات مفتوحة تجاوزت 24 ساعة دون عرض — تحتاج تدخلاً',       count: ct.openOld,      countLabel: 'طلب', urgent: ct.openOld > 5 },
        { id: 'b04', code: 'B-04', title: 'معدل التحويل الكامل',         desc: 'قمع: طلب ← عرض ← قبول ← إكمال — ملخص النسب' },
        { id: 'b05', code: 'B-05', title: 'وقت الاستجابة للعرض',         desc: 'من نشر الطلب إلى أول عرض — بالدقائق لكل طلب (30 يوم)' },
        { id: 'b06', code: 'B-06', title: 'وقت إكمال الوظائف',           desc: 'من قبول العرض إلى تأكيد الإكمال — بالساعات لكل وظيفة' },
        { id: 'b07', code: 'B-07', title: 'فجوة العرض والطلب',           desc: 'مدن وفئات فيها طلب عالٍ لكن مقدمو خدمة قليلون' },
      ],
    },
    {
      key: 'C', label: 'ج — المقدمون', color: 'emerald',
      reports: [
        { id: 'c01', code: 'C-01', title: 'أداء المقدمين',              desc: 'تقييم + إكمال + معدل رفض + بلاغات لكل مقدم خدمة', count: ct.allProviders, countLabel: 'مقدم' },
        { id: 'c02', code: 'C-02', title: 'المقدمون الخاملون',           desc: 'مشتركون لم يقدّموا أي عرض خلال 30 يوماً — قد يحتاجون تحفيزاً' },
        { id: 'c03', code: 'C-03', title: 'المقدمون المُبلَّغ عنهم',    desc: 'بلاغات نظام غير مراجَعة بعد',                          count: ct.flagged,      countLabel: 'بلاغ', urgent: ct.flagged > 0 },
        { id: 'c04', code: 'C-04', title: 'المقدمون الموقوفون',          desc: 'حسابات مقدمي خدمة تم إيقافها إدارياً',                  count: ct.suspended,    countLabel: 'موقوف' },
        { id: 'c05', code: 'C-05', title: 'توزيع المقدمين',              desc: 'حسب المدينة والفئة ومستوى السمعة — ملخص مجمّع' },
        { id: 'c06', code: 'C-06', title: 'أعلى 20 مقدم أداءً',         desc: 'الأفضل بالوظائف المنجزة والتقييم — يمكن مكافأتهم' },
      ],
    },
    {
      key: 'D', label: 'د — المستخدمون والنمو', color: 'violet',
      reports: [
        { id: 'd01', code: 'D-01', title: 'المستخدمون الجدد',      desc: 'تسجيلات آخر 30 يوم — عملاء ومقدمون يومياً', count: ct.newUsers30d, countLabel: 'مستخدم' },
        { id: 'd02', code: 'D-02', title: 'الاحتفاظ بالعملاء',     desc: 'عملاء طلبوا أكثر من مرة خلال 90 يوماً — مؤشر صحة المنصة' },
        { id: 'd03', code: 'D-03', title: 'العملاء الخاملون',       desc: 'سجّلوا لكن لم يرفعوا طلباً واحداً بعد' },
        { id: 'd04', code: 'D-04', title: 'توزيع المستخدمين',       desc: 'حسب المدينة ونوع الحساب (عميل / مقدم) — ملخص مجمّع' },
      ],
    },
    {
      key: 'E', label: 'هـ — الجودة والسلامة', color: 'rose',
      reports: [
        { id: 'e01', code: 'E-01', title: 'الإلغاءات',              desc: 'طلبات ملغاة آخر 30 يوم مع سبب الإلغاء والطرف المُلغي',    count: ct.cancelled30d, countLabel: 'إلغاء' },
        { id: 'e02', code: 'E-02', title: 'البلاغات والشكاوى',       desc: 'تقارير الإساءة المعلّقة بانتظار المراجعة',               count: ct.pendingRpts,  countLabel: 'بلاغ', urgent: ct.pendingRpts > 0 },
        { id: 'e03', code: 'E-03', title: 'الإلغاءات المتكررة',      desc: 'مستخدمون ألغوا 3 مرات أو أكثر في آخر 90 يوماً' },
        { id: 'e04', code: 'E-04', title: 'التقييمات المنخفضة',      desc: 'وظائف حصلت على تقييم نجمة أو نجمتين',                   count: ct.lowRatings,   countLabel: 'وظيفة' },
      ],
    },
    {
      key: 'F', label: 'و — النظام والتدقيق', color: 'slate',
      reports: [
        { id: 'f01', code: 'F-01', title: 'سجل إجراءات الأدمن',    desc: 'كل القرارات الإدارية (تعليق، تحذير، تبرئة) مع التوقيت', count: ct.auditCount, countLabel: 'إجراء' },
        { id: 'f02', code: 'F-02', title: 'أخطاء Edge Functions',   desc: 'السجلات في Supabase Dashboard — غير متاحة عبر قاعدة البيانات', noExport: true },
        { id: 'f03', code: 'F-03', title: 'الملخص الأسبوعي',        desc: 'إحصائيات آخر 7 أيام: مستخدمون، طلبات، إيراد، بلاغات' },
      ],
    },
  ];

  return (
    <div className="p-6 space-y-10" dir="rtl">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">التقارير</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            25 تقرير قابل للتصدير كـ CSV — يفتح مباشرة في Excel مع دعم العربية
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
          البيانات محدّثة لحظياً
        </div>
      </div>

      {/* Groups */}
      {groups.map(({ key, label, color, reports }) => (
        <div key={key} className="space-y-4">

          {/* Group header */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-800" />
            <h2 className={`text-xs font-bold px-3 py-1.5 rounded-full border ${BADGE[color]}`}>
              {label}
            </h2>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {reports.map(({ id, code, title, desc, count, countLabel, urgent, noExport }) => (
              <div
                key={id}
                className={`bg-slate-900 border rounded-2xl p-4 flex flex-col gap-3 transition-colors
                  ${urgent ? 'border-rose-500/40 bg-rose-950/10' : 'border-slate-800 hover:border-slate-700'}`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${BADGE[color]}`}>
                    {code}
                  </span>
                  {urgent && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                      ⚠ يحتاج انتباهاً
                    </span>
                  )}
                </div>

                {/* Title + desc */}
                <div className="flex-1">
                  <div className="text-slate-200 font-semibold text-sm">{title}</div>
                  <div className="text-slate-500 text-xs mt-1 leading-relaxed">{desc}</div>
                </div>

                {/* Bottom row: count + export */}
                <div className="flex items-end justify-between pt-3 border-t border-slate-800/60">
                  <div>
                    {count !== undefined ? (
                      <>
                        <div className={`text-2xl font-bold leading-none ${urgent ? 'text-rose-400' : COUNT_CLR[color]}`}>
                          {count.toLocaleString('ar')}
                        </div>
                        <div className="text-slate-600 text-[10px] mt-0.5">{countLabel}</div>
                      </>
                    ) : (
                      <div className="text-slate-700 text-[10px]">تقرير تحليلي</div>
                    )}
                  </div>

                  {noExport ? (
                    <a
                      href="https://supabase.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-slate-700 hover:text-slate-500 transition-colors"
                    >
                      Supabase Dashboard ↗
                    </a>
                  ) : (
                    <a
                      href={`/api/reports/${id}`}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${BTN[color]}`}
                    >
                      تصدير CSV
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M6 1v7M3 5l3 3 3-3M2 10h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
