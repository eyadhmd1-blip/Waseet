import { supabaseAdmin } from './lib/supabase';
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
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ── data ─────────────────────────────────────────────────────

const DASHBOARD_EMPTY = {
  totalUsers: 0, totalProviders: 0, totalRequests: 0, totalJobs: 0,
  openRequests: 0, activeJobs: 0, newUsers30: 0, completedJobs30: 0,
  disabledUsers: 0, urgentOpen: 0, contractsBidding: 0, subscribedProviders: 0,
  recentRequests: [] as any[], recentUsers: [] as any[], alertStalled: [] as any[], topCities: [] as [string, number][],
  _error: true,
};

async function getDashboardData() {
  const cutoff30 = daysAgo(30);
  const cutoff7  = daysAgo(7);

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
    { data: alertStalled },   // open requests older than 48h with 0 bids
    { data: cityStats },
  ] = await Promise.all([
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('providers').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('requests').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('jobs').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabaseAdmin.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', cutoff30),
    supabaseAdmin.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('updated_at', cutoff30),
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).eq('is_disabled', true),
    supabaseAdmin.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('is_urgent', true),
    supabaseAdmin.from('recurring_contracts').select('*', { count: 'exact', head: true }).eq('status', 'bidding'),
    supabaseAdmin.from('providers').select('*', { count: 'exact', head: true }).eq('is_subscribed', true),

    supabaseAdmin.from('requests')
      .select('id, title, city, status, created_at, category_slug, is_urgent')
      .order('created_at', { ascending: false })
      .limit(8),

    supabaseAdmin.from('users')
      .select('id, full_name, role, city, created_at, phone_verified')
      .order('created_at', { ascending: false })
      .limit(8),

    // Requests open for > 2 days with no bids (stalled) — proxy via views_count=0
    supabaseAdmin.from('requests')
      .select('id, title, city, created_at, category_slug')
      .eq('status', 'open')
      .lt('created_at', daysAgo(2))
      .order('created_at', { ascending: true })
      .limit(5),

    // City breakdown
    supabaseAdmin.from('requests')
      .select('city')
      .gte('created_at', cutoff30),
  ]);

  // Tally city counts
  const cityMap: Record<string, number> = {};
  (cityStats ?? []).forEach((r: any) => {
    cityMap[r.city] = (cityMap[r.city] ?? 0) + 1;
  });
  const topCities = Object.entries(cityMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return {
    totalUsers:          totalUsers         ?? 0,
    totalProviders:      totalProviders     ?? 0,
    totalRequests:       totalRequests      ?? 0,
    totalJobs:           totalJobs          ?? 0,
    openRequests:        openRequests       ?? 0,
    activeJobs:          activeJobs         ?? 0,
    newUsers30:          newUsers30         ?? 0,
    completedJobs30:     completedJobs30    ?? 0,
    disabledUsers:       disabledUsers      ?? 0,
    urgentOpen:          urgentOpen         ?? 0,
    contractsBidding:    contractsBidding   ?? 0,
    subscribedProviders: subscribedProviders ?? 0,
    recentRequests:      recentRequests     ?? [],
    recentUsers:         recentUsers        ?? [],
    alertStalled:        alertStalled       ?? [],
    topCities,
    _error: false,
  };
  } catch (err) {
    console.error('[dashboard] getDashboardData failed:', err);
    return DASHBOARD_EMPTY;
  }
}

// ── status config ─────────────────────────────────────────────

const REQ_STATUS: Record<string, { label: string; variant: 'info' | 'warning' | 'success' | 'muted' }> = {
  open:        { label: 'مفتوح', variant: 'info' },
  in_progress: { label: 'جارٍ',  variant: 'warning' },
  completed:   { label: 'منجز',  variant: 'success' },
  cancelled:   { label: 'ملغي',  variant: 'muted' },
};

const ROLE_META: Record<string, { label: string; variant: 'info' | 'violet' | 'danger' }> = {
  client:   { label: 'عميل',  variant: 'info' },
  provider: { label: 'مزود',  variant: 'violet' },
  admin:    { label: 'مدير',  variant: 'danger' },
};

// ── page ─────────────────────────────────────────────────────

export default async function DashboardPage() {
  const d = await getDashboardData();

  const completionRate = d.totalRequests > 0
    ? Math.round((d.completedJobs30 / Math.max(d.totalRequests, 1)) * 100)
    : 0;

  return (
    <div className="p-6 space-y-8">

      {/* ── DB error banner ── */}
      {d._error && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-2xl px-5 py-4 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <p className="text-red-400 text-sm font-medium">تعذّر تحميل بيانات اللوحة — تحقق من اتصال Supabase.</p>
        </div>
      )}

      {/* ── Alert bar (stalled requests) ── */}
      {d.alertStalled.length > 0 && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-2xl px-5 py-4 flex items-start gap-3">
          <span className="text-xl mt-0.5">🚨</span>
          <div>
            <p className="text-red-400 font-bold text-sm mb-1">
              {d.alertStalled.length} طلب مفتوح منذ أكثر من 48 ساعة بدون عروض
            </p>
            <div className="flex flex-wrap gap-2">
              {d.alertStalled.map((r: any) => (
                <a
                  key={r.id}
                  href={`/requests?highlight=${r.id}`}
                  className="text-xs text-red-300 underline underline-offset-2"
                >
                  {r.title.slice(0, 30)}… ({r.city})
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── KPI grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="👥" label="إجمالي المستخدمين"  value={d.totalUsers}          sub={`+${d.newUsers30} هذا الشهر`} />
        <StatCard icon="🔧" label="المزودون"            value={d.totalProviders}      sub={`${d.subscribedProviders} مشترك`} accent />
        <StatCard icon="📋" label="إجمالي الطلبات"      value={d.totalRequests}       sub={`${d.openRequests} مفتوح الآن`} />
        <StatCard icon="💼" label="إجمالي الأعمال"      value={d.totalJobs}           sub={`${d.completedJobs30} منجز هذا الشهر`} />
        <StatCard icon="🔓" label="طلبات مفتوحة"        value={d.openRequests}        sub="بانتظار عروض" />
        <StatCard icon="🛠️" label="أعمال نشطة"          value={d.activeJobs}          sub="جارٍ تنفيذها" />
        <StatCard icon="🚨" label="طلبات طارئة نشطة"   value={d.urgentOpen}          sub="ضمن نافذة 60 دقيقة" danger={d.urgentOpen > 0} />
        <StatCard icon="🔄" label="عقود بانتظار عروض"  value={d.contractsBidding}    sub="عقود دورية" />
      </div>

      {/* ── Secondary metrics row ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-right">
          <p className="text-slate-500 text-xs mb-2">معدل الإنجاز (30 يوم)</p>
          <div className="flex items-end gap-2 flex-row-reverse">
            <span className="text-3xl font-black text-amber-400">{completionRate}%</span>
          </div>
          <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-right">
          <p className="text-slate-500 text-xs mb-2">مستخدمون موقوفون</p>
          <span className={`text-3xl font-black ${d.disabledUsers > 0 ? 'text-red-400' : 'text-slate-600'}`}>
            {d.disabledUsers}
          </span>
          <p className="text-xs text-slate-600 mt-2">حساب معطّل</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-right">
          <p className="text-slate-500 text-xs mb-4">أكثر المدن نشاطاً (30 يوم)</p>
          <div className="space-y-2">
            {d.topCities.map(([city, count], i) => {
              const max = d.topCities[0]?.[1] ?? 1;
              return (
                <div key={city} className="flex items-center gap-2 flex-row-reverse">
                  <span className="text-xs text-slate-400 w-12 text-right shrink-0">{city}</span>
                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400/70 rounded-full"
                      style={{ width: `${(count / max) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-600 w-6 text-left shrink-0">{count}</span>
                </div>
              );
            })}
            {d.topCities.length === 0 && (
              <p className="text-slate-700 text-xs text-center">لا توجد بيانات بعد</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent requests */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <a href="/requests" className="text-xs text-amber-400 hover:underline">عرض الكل ←</a>
            <h2 className="text-sm font-bold text-slate-100">آخر الطلبات</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {d.recentRequests.length === 0 && (
              <p className="text-slate-600 text-sm text-center py-6">لا توجد طلبات بعد</p>
            )}
            {d.recentRequests.map((r: any) => {
              const st = REQ_STATUS[r.status] ?? REQ_STATUS.open;
              return (
                <div key={r.id} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="flex items-center gap-2">
                    {r.is_urgent && <span className="text-red-400 text-xs">🚨</span>}
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                  <div className="text-right flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{r.title}</p>
                    <p className="text-xs text-slate-500">{r.city} · {fmtDate(r.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent users */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <a href="/users" className="text-xs text-amber-400 hover:underline">عرض الكل ←</a>
            <h2 className="text-sm font-bold text-slate-100">آخر المسجلين</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {d.recentUsers.length === 0 && (
              <p className="text-slate-600 text-sm text-center py-6">لا يوجد مستخدمون بعد</p>
            )}
            {d.recentUsers.map((u: any) => {
              const role = ROLE_META[u.role] ?? ROLE_META.client;
              return (
                <div key={u.id} className="flex items-center gap-3 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-slate-900 font-bold text-sm shrink-0">
                    {u.full_name.charAt(0)}
                  </div>
                  <div className="flex-1 text-right min-w-0">
                    <div className="flex items-center justify-end gap-1.5">
                      {u.phone_verified && <span className="text-emerald-400 text-xs">✓</span>}
                      <p className="text-sm text-slate-200 font-medium">{u.full_name}</p>
                    </div>
                    <p className="text-xs text-slate-500">{u.city} · {fmtDate(u.created_at)}</p>
                  </div>
                  <Badge variant={role.variant}>{role.label}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
