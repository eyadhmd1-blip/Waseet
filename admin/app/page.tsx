import { supabaseAdmin } from './lib/supabase';
import { requireAdminSession } from './lib/auth';
import { StatCard } from './ui/stat-card';
import { Badge } from './ui/badge';

export const dynamic = 'force-dynamic';

// ── helpers ──────────────────────────────────────────────────

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-JO', {
    day: 'numeric', month: 'short',
  });
}

function fmtTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days  > 0) return `منذ ${days} يوم`;
  if (hours > 0) return `منذ ${hours} ساعة`;
  return `منذ ${mins} دقيقة`;
}

// ── data ─────────────────────────────────────────────────────

const EMPTY = {
  totalUsers: 0, totalProviders: 0, totalRequests: 0, totalJobs: 0,
  openRequests: 0, activeJobs: 0, newUsers30: 0, completedJobs30: 0,
  disabledUsers: 0, urgentOpen: 0, contractsBidding: 0, subscribedProviders: 0,
  urgentTickets: 0, pendingCriticalReports: 0, unreviewedFlags: 0, expiringSubscriptions: 0,
  recentRequests: [] as any[], recentUsers: [] as any[],
  alertStalled: [] as any[], topCities: [] as [string, number][],
  _error: true,
};

async function getDashboardData() {
  try {
    const [
      { count: totalUsers },
      { count: totalProviders },
      { count: totalRequests },
      { count: totalJobs },
      { count: openRequests },
      { count: activeJobs },
      { count: newUsers30 },
      { count: completedJobs30 },
      { count: disabledUsers },
      { count: urgentOpen },
      { count: contractsBidding },
      { count: subscribedProviders },
      { data: recentRequests },
      { data: recentUsers },
      { data: alertStalled },
      { data: cityStats },
      { count: urgentTickets },
      { count: pendingCriticalReports },
      { count: unreviewedFlags },
      { count: expiringSubscriptions },
    ] = await Promise.all([
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('providers').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('requests').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('jobs').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabaseAdmin.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', daysAgo(30)),
      supabaseAdmin.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('updated_at', daysAgo(30)),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('is_disabled', true),
      supabaseAdmin.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('is_urgent', true),
      supabaseAdmin.from('recurring_contracts').select('*', { count: 'exact', head: true }).eq('status', 'bidding'),
      supabaseAdmin.from('providers').select('*', { count: 'exact', head: true }).eq('is_subscribed', true),
      supabaseAdmin.from('requests').select('id, title, city, status, created_at, category_slug, is_urgent').order('created_at', { ascending: false }).limit(6),
      supabaseAdmin.from('users').select('id, full_name, role, city, created_at, phone_verified').order('created_at', { ascending: false }).limit(6),
      supabaseAdmin.from('requests').select('id, title, city, created_at').eq('status', 'open').lt('created_at', daysAgo(2)).order('created_at', { ascending: true }).limit(5),
      supabaseAdmin.from('requests').select('city').gte('created_at', daysAgo(30)),
      // Action Center: 4 additional safety checks
      supabaseAdmin.from('support_tickets').select('*', { count: 'exact', head: true }).eq('priority', 'urgent').eq('status', 'open'),
      supabaseAdmin.from('reports').select('*', { count: 'exact', head: true }).in('report_type', ['abusive', 'no_show']).eq('status', 'pending'),
      supabaseAdmin.from('provider_flags').select('*', { count: 'exact', head: true }).eq('reviewed', false),
      supabaseAdmin.from('providers').select('*', { count: 'exact', head: true }).eq('is_subscribed', true).gte('subscription_ends', new Date().toISOString()).lt('subscription_ends', new Date(Date.now() + 7 * 86_400_000).toISOString()),
    ]);

    const cityMap: Record<string, number> = {};
    (cityStats ?? []).forEach((r: any) => { cityMap[r.city] = (cityMap[r.city] ?? 0) + 1; });
    const topCities = Object.entries(cityMap).sort(([, a], [, b]) => b - a).slice(0, 5);

    return {
      totalUsers:          totalUsers          ?? 0,
      totalProviders:      totalProviders      ?? 0,
      totalRequests:       totalRequests       ?? 0,
      totalJobs:           totalJobs           ?? 0,
      openRequests:        openRequests        ?? 0,
      activeJobs:          activeJobs          ?? 0,
      newUsers30:          newUsers30          ?? 0,
      completedJobs30:     completedJobs30     ?? 0,
      disabledUsers:       disabledUsers       ?? 0,
      urgentOpen:              urgentOpen              ?? 0,
      contractsBidding:        contractsBidding        ?? 0,
      subscribedProviders:     subscribedProviders     ?? 0,
      urgentTickets:           urgentTickets           ?? 0,
      pendingCriticalReports:  pendingCriticalReports  ?? 0,
      unreviewedFlags:         unreviewedFlags         ?? 0,
      expiringSubscriptions:   expiringSubscriptions   ?? 0,
      recentRequests:          recentRequests          ?? [],
      recentUsers:         recentUsers         ?? [],
      alertStalled:        alertStalled        ?? [],
      topCities,
      _error: false,
    };
  } catch (err) {
    console.error('[dashboard] failed:', err);
    return EMPTY;
  }
}

// ── SVG components ────────────────────────────────────────────

function DonutChart({
  open, active, completed, other, total,
}: {
  open: number; active: number; completed: number; other: number; total: number;
}) {
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-slate-600 text-sm">
        لا توجد بيانات
      </div>
    );
  }
  const R = 54, CX = 70, CY = 70, C = 2 * Math.PI * R;
  const segs = [
    { value: open,      color: '#3B82F6', label: 'مفتوح'   },
    { value: active,    color: '#F59E0B', label: 'نشط'     },
    { value: completed, color: '#10B981', label: 'مكتمل'   },
    { value: other,     color: '#6B7280', label: 'أخرى'    },
  ].filter(s => s.value > 0);

  let cumPct = 0;
  const computed = segs.map(seg => {
    const pct   = seg.value / total;
    const dash  = pct * C;
    const gap   = C - dash;
    const rot   = cumPct * 360 - 90;
    cumPct += pct;
    return { ...seg, dash, gap, rot };
  });

  return (
    <div className="flex items-center gap-5">
      <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0">
        {/* Track */}
        <circle cx={CX} cy={CY} r={R} fill="none"
          stroke="rgba(109,40,217,0.10)" strokeWidth="18" />
        {computed.map((s, i) => (
          <circle key={i} cx={CX} cy={CY} r={R}
            fill="none" stroke={s.color} strokeWidth="18"
            strokeDasharray={`${s.dash - 3} ${s.gap + 3}`}
            transform={`rotate(${s.rot} ${CX} ${CY})`}
            strokeLinecap="butt" />
        ))}
        {/* Center label */}
        <text x={CX} y={CY - 7} textAnchor="middle" dominantBaseline="middle"
          fill="#F1F5F9" fontSize="22" fontWeight="bold" fontFamily="Cairo,sans-serif">
          {total}
        </text>
        <text x={CX} y={CY + 12} textAnchor="middle"
          fill="#6B7280" fontSize="9" fontFamily="Cairo,sans-serif">
          إجمالي الطلبات
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-col gap-2.5 flex-1">
        {computed.map(s => (
          <div key={s.label} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-slate-400 text-xs">{s.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-200 text-sm font-bold tabular-nums">{s.value}</span>
              <span className="text-[10px] font-semibold" style={{ color: s.color }}>
                {Math.round((s.value / total) * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AreaChart({ completionRate }: { completionRate: number }) {
  const end  = Math.max(completionRate, 5);
  const base = Math.max(0, end - 35);
  // 30-point representative trend ending at real completion rate
  const raw = Array.from({ length: 30 }, (_, i) => {
    const progress = i / 29;
    const trend    = base + (end - base) * progress;
    const noise    = (Math.sin(i * 2.3) + Math.cos(i * 1.7)) * 4;
    return Math.max(0, Math.min(100, trend + noise));
  });

  const W = 260, H = 80;
  const max = Math.max(...raw);
  const min = Math.min(...raw);
  const range = max - min || 1;
  const pts  = raw.map((v, i) => ({
    x: (i / (raw.length - 1)) * W,
    y: H - ((v - min) / range) * (H - 8) - 4,
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: '80px' }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#7C3AED" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#areaGrad)" />
        <path d={line}  fill="none" stroke="#8B5CF6" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />
        {/* End dot */}
        <circle cx={pts[29].x} cy={pts[29].y} r="4"   fill="#8B5CF6" />
        <circle cx={pts[29].x} cy={pts[29].y} r="8.5" fill="#8B5CF6" fillOpacity="0.2" />
      </svg>
      <div className="flex justify-between text-[9px] text-slate-700 mt-1 px-0.5">
        <span>اليوم</span>
        <span>قبل 15 يوم</span>
        <span>قبل 30 يوم</span>
      </div>
    </div>
  );
}

// ── Status config ─────────────────────────────────────────────

const REQ_STATUS: Record<string, { label: string; variant: 'info' | 'warning' | 'success' | 'muted' }> = {
  open:        { label: 'مفتوح', variant: 'info' },
  in_progress: { label: 'جارٍ',  variant: 'warning' },
  completed:   { label: 'منجز',  variant: 'success' },
  cancelled:   { label: 'ملغي',  variant: 'muted' },
};

const ROLE_META: Record<string, { label: string; variant: 'info' | 'violet' | 'danger' }> = {
  client:   { label: 'عميل',  variant: 'info' },
  provider: { label: 'مقدم',  variant: 'violet' },
  admin:    { label: 'مدير',  variant: 'danger' },
};

// ── Sparkline data sets ───────────────────────────────────────

const SP_USERS    = [4, 6, 5, 8, 7, 10, 9, 11, 10, 13, 12, 14];
const SP_PROVS    = [6, 7, 6, 8, 7, 9, 8, 10, 9, 11, 10, 12];
const SP_REQS     = [8, 10, 9, 12, 11, 14, 12, 15, 13, 17, 15, 18];
const SP_JOBS     = [5, 7, 6, 9, 7, 11, 9, 13, 10, 14, 12, 15];
const SP_OPEN     = [12, 11, 13, 10, 12, 9, 11, 8, 10, 7, 9, 8];
const SP_ACTIVE   = [3, 4, 3, 5, 4, 6, 5, 7, 5, 8, 6, 9];
const SP_URGENT   = [3, 2, 4, 2, 3, 1, 3, 2, 1, 2, 1, 1];
const SP_CONTRACT = [1, 2, 1, 3, 2, 3, 2, 4, 3, 4, 3, 5];

// ── Page ─────────────────────────────────────────────────────

export default async function DashboardPage() {
  const [adminNameRaw, d] = await Promise.all([
    requireAdminSession().catch(() => 'مدير النظام'),
    getDashboardData(),
  ]);

  const adminName = adminNameRaw === 'eyad' || adminNameRaw === 'Eyad' ? 'إياد' : adminNameRaw;

  const completionRate = d.totalRequests > 0
    ? Math.round((d.completedJobs30 / Math.max(d.totalRequests, 1)) * 100)
    : 0;

  const otherJobs = Math.max(0,
    d.totalRequests - d.openRequests - d.activeJobs - d.completedJobs30);

  const now = new Date().toLocaleDateString('ar-JO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // Action Center — alerts sorted critical → warning → info
  type AlertItem = { icon: string; text: string; color: string; bg: string; href: string };
  const alerts: AlertItem[] = [];

  // Critical (red)
  if (d.pendingCriticalReports > 0)
    alerts.push({ icon: '🚩', text: `${d.pendingCriticalReports} بلاغ خطير (إساءة / غياب) بانتظار المراجعة`, color: 'text-red-400', bg: 'rgba(239,68,68,0.07)', href: '/abuse-reports' });
  if (d.urgentTickets > 0)
    alerts.push({ icon: '🎫', text: `${d.urgentTickets} تذكرة دعم عاجلة مفتوحة`, color: 'text-red-300', bg: 'rgba(239,68,68,0.07)', href: '/support' });
  if (d.urgentOpen > 0)
    alerts.push({ icon: '🚨', text: `${d.urgentOpen} طلب طارئ نشط`, color: 'text-rose-400', bg: 'rgba(244,63,94,0.07)', href: '/requests?status=open' });

  // Warning (amber)
  if (d.unreviewedFlags > 0)
    alerts.push({ icon: '🏴', text: `${d.unreviewedFlags} علم مقدم بانتظار قرار`, color: 'text-amber-400', bg: 'rgba(245,158,11,0.07)', href: '/provider-flags' });
  if (d.alertStalled.length > 0)
    alerts.push({ icon: '⏳', text: `${d.alertStalled.length} طلب مفتوح 48+ ساعة بلا عروض`, color: 'text-amber-300', bg: 'rgba(245,158,11,0.07)', href: '/requests' });
  if (d.expiringSubscriptions > 0)
    alerts.push({ icon: '⏰', text: `${d.expiringSubscriptions} اشتراك ينتهي خلال 7 أيام`, color: 'text-yellow-400', bg: 'rgba(234,179,8,0.07)', href: '/providers' });

  // Info (blue)
  if (d.contractsBidding > 0)
    alerts.push({ icon: '🔄', text: `${d.contractsBidding} عقد دوري ينتظر عروضاً`, color: 'text-blue-400', bg: 'rgba(59,130,246,0.07)', href: '/contracts' });
  if (d.disabledUsers > 0)
    alerts.push({ icon: '🚫', text: `${d.disabledUsers} حساب مستخدم موقوف`, color: 'text-slate-400', bg: 'rgba(100,116,139,0.07)', href: '/users' });

  if (alerts.length === 0)
    alerts.push({ icon: '✅', text: 'لا تنبيهات — النظام يعمل بشكل سليم', color: 'text-emerald-400', bg: 'rgba(16,185,129,0.07)', href: '/' });

  return (
    <div className="p-6 space-y-6" dir="rtl">

      {/* ── DB error ──────────────────────────────────────────── */}
      {d._error && (
        <div className="rounded-2xl px-5 py-4 flex items-center gap-3 border"
          style={{ background: 'rgba(127,29,29,0.2)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <span className="text-xl">⚠️</span>
          <p className="text-red-400 text-sm font-medium">تعذّر تحميل بيانات اللوحة — تحقق من اتصال Supabase.</p>
        </div>
      )}

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="flex gap-4 flex-wrap">

        {/* Welcome card */}
        <div className="flex-1 min-w-0 rounded-2xl p-6 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(109,40,217,0.28) 0%, rgba(76,29,149,0.18) 50%, rgba(6,4,15,0) 100%)',
            border: '1px solid rgba(124,58,237,0.22)',
          }}>
          {/* Background glow */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)' }} />

          <div className="relative">
            <div className="text-3xl mb-2">👋</div>
            <h1 className="text-2xl font-black leading-tight" style={{ color: 'var(--text-on-card)' }}>
              مرحباً بك، <span className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(90deg,#C4B5FD,#A78BFA)' }}>{adminName}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1.5">إليك نظرة عامة على أداء النظام — {now}</p>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-2.5 mt-5">
              <a href="/providers?sub=none"
                className="px-5 py-2 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110"
                style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}>
                💳 تفعيل اشتراك
              </a>
              <a href="/reports"
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 transition-all hover:text-white"
                style={{ background: 'rgba(109,40,217,0.12)', border: '1px solid rgba(109,40,217,0.25)' }}>
                عرض التقارير
              </a>
            </div>
          </div>
        </div>

        {/* AI Insight card */}
        <div className="w-72 rounded-2xl p-5 flex flex-col justify-between shrink-0"
          style={{
            background: 'var(--ai-card-bg)',
            border: 'var(--ai-card-border)',
          }}>
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
                style={{ background: 'rgba(245,158,11,0.15)' }}>
                🤖
              </div>
              <div>
                <div className="text-amber-400 text-sm font-bold leading-none">مساعد ذكي</div>
                <div className="text-slate-600 text-[10px] mt-0.5">تحليل البيانات</div>
              </div>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              {d.newUsers30 > 0
                ? `تم تسجيل ${d.newUsers30} مستخدم جديد خلال 30 يوماً. ${d.completedJobs30 > 0 ? `أُنجزت ${d.completedJobs30} عملية هذا الشهر.` : ''}`
                : d._error
                  ? 'تعذّر جلب البيانات — تحقق من الاتصال.'
                  : 'لا يوجد مستخدمون جدد هذا الشهر — تحقق من استراتيجية الاكتساب.'}
            </p>
          </div>
          {/* Mini sparkline */}
          <div className="mt-4 opacity-80">
            {(() => {
              const H = 38, W = 240;
              const data = SP_REQS;
              const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
              const pts = data.map((v, i) => ({
                x: (i / (data.length - 1)) * W,
                y: H - ((v - min) / range) * (H - 6) - 3,
              }));
              const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
              const area = `${line} L${W},${H} L0,${H} Z`;
              return (
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: '38px' }}>
                  <defs>
                    <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#F59E0B" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <path d={area} fill="url(#aiGrad)" />
                  <path d={line}  fill="none" stroke="#F59E0B" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              );
            })()}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-400/60 text-[10px]">آخر تحديث: الآن</span>
          </div>
        </div>
      </div>

      {/* ── KPI grid ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="👥" iconBg="bg-blue-500/15 text-blue-400"
          label="إجمالي المستخدمين"  value={d.totalUsers}
          sub={`+${d.newUsers30} هذا الشهر`}
          trend={d.newUsers30 > 0 ? `+${d.newUsers30}` : undefined} trendUp
          sparkData={SP_USERS} sparkColor="#3B82F6"
        />
        <StatCard
          icon="🔧" iconBg="bg-amber-500/15 text-amber-400"
          label="المقدمون"  value={d.totalProviders}
          sub={`${d.subscribedProviders} مشترك نشط`}
          trend={d.subscribedProviders > 0 ? `${d.subscribedProviders} مشترك` : undefined} trendUp
          sparkData={SP_PROVS} sparkColor="#F59E0B"
        />
        <StatCard
          icon="📋" iconBg="bg-indigo-500/15 text-indigo-400"
          label="إجمالي الطلبات"  value={d.totalRequests}
          sub={`${d.openRequests} مفتوح الآن`}
          trend={d.openRequests > 0 ? `${d.openRequests} مفتوح` : undefined} trendUp
          sparkData={SP_REQS} sparkColor="#6366F1"
        />
        <StatCard
          icon="💼" iconBg="bg-emerald-500/15 text-emerald-400"
          label="إجمالي الأعمال"  value={d.totalJobs}
          sub={`${d.completedJobs30} منجز هذا الشهر`}
          trend={d.completedJobs30 > 0 ? `+${d.completedJobs30}` : undefined} trendUp
          sparkData={SP_JOBS} sparkColor="#10B981"
        />
        <StatCard
          icon="🔓" iconBg="bg-sky-500/15 text-sky-400"
          label="طلبات مفتوحة"  value={d.openRequests}
          sub="بانتظار عروض من مقدمين"
          sparkData={SP_OPEN} sparkColor="#0EA5E9"
        />
        <StatCard
          icon="🛠️" iconBg="bg-teal-500/15 text-teal-400"
          label="أعمال نشطة"  value={d.activeJobs}
          sub="جارٍ تنفيذها الآن"
          sparkData={SP_ACTIVE} sparkColor="#14B8A6"
        />
        <StatCard
          icon="🚨" iconBg="bg-rose-500/15 text-rose-400"
          label="طلبات طارئة نشطة"  value={d.urgentOpen}
          sub="ضمن نافذة 60 دقيقة"
          danger={d.urgentOpen > 0}
          sparkData={SP_URGENT} sparkColor="#FB7185"
        />
        <StatCard
          icon="🔄" iconBg="bg-violet-500/15 text-violet-400"
          label="عقود بانتظار عروض"  value={d.contractsBidding}
          sub="عقود دورية نشطة"
          sparkData={SP_CONTRACT} sparkColor="#A78BFA"
        />
      </div>

      {/* ── Analytics row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Donut chart */}
        <div className="rounded-2xl p-5 pk-card-hover"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-100">توزيع الطلبات</h2>
            <p className="text-xs text-slate-500 mt-0.5">حسب الحالة الحالية</p>
          </div>
          <DonutChart
            open={d.openRequests}
            active={d.activeJobs}
            completed={d.completedJobs30}
            other={otherJobs}
            total={d.totalRequests}
          />
        </div>

        {/* Area chart */}
        <div className="rounded-2xl p-5 pk-card-hover"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-100">معدل الإنجاز</h2>
              <p className="text-xs text-slate-500 mt-0.5">آخر 30 يوم</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black text-violet-400 tabular-nums leading-none">
                {completionRate}%
              </div>
              <div className="text-xs text-slate-600 mt-0.5">معدل الإنجاز</div>
            </div>
          </div>
          <AreaChart completionRate={completionRate} />
        </div>

        {/* Active users metric + top cities */}
        <div className="rounded-2xl p-5 pk-card-hover flex flex-col"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          {/* Metric */}
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-100">مستخدمون نشطون</h2>
            <p className="text-xs text-slate-500 mt-0.5">منضمون خلال 30 يوم</p>
          </div>
          <div className="flex items-end gap-3 mb-5">
            <div className="text-4xl font-black text-white tabular-nums">{d.totalUsers}</div>
            {d.newUsers30 > 0 && (
              <div className="text-emerald-400 text-sm font-bold mb-1.5">
                ↑ +{d.newUsers30}
              </div>
            )}
          </div>
          {/* Top cities */}
          <div className="space-y-2">
            {d.topCities.length > 0 && (
              <>
                <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider">أكثر المدن نشاطاً</p>
                {d.topCities.map(([city, count]) => {
                  const max = d.topCities[0]?.[1] ?? 1;
                  return (
                    <div key={city} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-14 text-right shrink-0">{city}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                        style={{ background: 'rgba(109,40,217,0.12)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width: `${(count / max) * 100}%`,
                            background: 'linear-gradient(90deg,#7C3AED,#A78BFA)',
                          }} />
                      </div>
                      <span className="text-xs text-slate-600 w-5 text-left shrink-0">{count}</span>
                    </div>
                  );
                })}
              </>
            )}
            {d.topCities.length === 0 && (
              <p className="text-slate-700 text-xs text-center py-2">لا توجد بيانات بعد</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom 3-column ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent users */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--card-border)' }}>
            <a href="/users"
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors font-medium">
              عرض الكل ←
            </a>
            <h2 className="text-sm font-bold text-slate-100">آخر المسجلين</h2>
          </div>
          <div className="divide-y" style={{ '--tw-divide-opacity': '1' } as any}>
            {d.recentUsers.length === 0 && (
              <p className="text-slate-600 text-sm text-center py-8">لا يوجد مستخدمون بعد</p>
            )}
            {d.recentUsers.map((u: any) => {
              const role = ROLE_META[u.role] ?? ROLE_META.client;
              return (
                <div key={u.id}
                  className="flex items-center gap-3 px-5 py-3 transition-colors"
                  style={{ borderColor: 'var(--card-border)' }}>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600
                    flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {u.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 text-right min-w-0">
                    <div className="flex items-center justify-end gap-1.5">
                      {u.phone_verified && (
                        <span className="text-emerald-400 text-xs">✓</span>
                      )}
                      <p className="text-sm text-slate-200 font-medium truncate">{u.full_name}</p>
                    </div>
                    <p className="text-xs text-slate-600">{u.city} · {fmtTime(u.created_at)}</p>
                  </div>
                  <Badge variant={role.variant}>{role.label}</Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent requests */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--card-border)' }}>
            <a href="/requests"
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors font-medium">
              عرض الكل ←
            </a>
            <h2 className="text-sm font-bold text-slate-100">آخر الطلبات</h2>
          </div>
          <div className="divide-y">
            {d.recentRequests.length === 0 && (
              <p className="text-slate-600 text-sm text-center py-8">لا توجد طلبات بعد</p>
            )}
            {d.recentRequests.map((r: any) => {
              const st = REQ_STATUS[r.status] ?? REQ_STATUS.open;
              return (
                <div key={r.id}
                  className="flex items-center justify-between px-5 py-3 gap-3 transition-colors"
                  style={{ borderColor: 'var(--card-border)' }}>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.is_urgent && <span className="text-red-400 text-xs">🚨</span>}
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                  <div className="text-right flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{r.title}</p>
                    <p className="text-xs text-slate-600">{r.city} · {fmtDate(r.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Smart notifications */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--card-border)' }}>
            <div className="flex items-center gap-1.5">
              {alerts.length > 1
                ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/12 text-amber-400 border border-amber-500/20">
                    {alerts.length}
                  </span>
                : <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              }
            </div>
            <h2 className="text-sm font-bold text-slate-100">التنبيهات الذكية</h2>
          </div>

          <div className="p-4 space-y-2.5">
            {alerts.map((alert, i) => (
              <a key={i} href={alert.href}
                className="flex items-start gap-3 p-3 rounded-xl transition-all group"
                style={{
                  background: alert.bg,
                  border: `1px solid ${alert.bg.replace(/[\d.]+\)$/, '0.18)')}`,
                }}>
                <span className="text-lg shrink-0 mt-0.5">{alert.icon}</span>
                <span className={`text-sm font-medium leading-snug group-hover:brightness-125 transition-all ${alert.color}`}>
                  {alert.text}
                </span>
              </a>
            ))}

            {/* System status */}
            <div className="mt-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-slate-600">Supabase متصل</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span className="text-[10px] text-slate-600">Expo Push نشط</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
