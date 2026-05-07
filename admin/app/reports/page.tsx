import { supabaseAdmin } from '../lib/supabase';

export const dynamic = 'force-dynamic';

function fmtMoney(n: number) {
  return n.toLocaleString('ar-JO') + ' د.أ';
}

const SUB_PRICES: Record<string, number> = {
  basic:   5,
  pro:     12,
  premium: 25,
};

const SUB_LABEL: Record<string, string> = {
  basic:   'أساسية',
  pro:     'محترف',
  premium: 'متميز',
};

async function getReportData() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const [
    { data: providers },
    { data: requests30 },
    { data: usersAll },
    { data: contracts },
  ] = await Promise.all([
    supabaseAdmin
      .from('providers')
      .select('subscription_tier, is_subscribed, created_at, user:users(city)'),
    supabaseAdmin
      .from('requests')
      .select('city, category_slug, status, created_at, ai_suggested_price_min, ai_suggested_price_max')
      .gte('created_at', thirtyDaysAgo),
    supabaseAdmin
      .from('users')
      .select('created_at, role')
      .gte('created_at', thirtyDaysAgo),
    supabaseAdmin
      .from('recurring_contracts')
      .select('status, price_per_visit, frequency, duration_months, created_at')
      .gte('created_at', thirtyDaysAgo),
  ]);

  return {
    providers:  providers  ?? [],
    requests30: requests30 ?? [],
    usersAll:   usersAll   ?? [],
    contracts:  contracts  ?? [],
  };
}

export default async function ReportsPage() {
  const { providers, requests30, usersAll, contracts } = await getReportData();

  // ── Subscription revenue ──────────────────────────────────────────────────
  const subCounts: Record<string, number> = { basic: 0, pro: 0, premium: 0 };
  for (const p of providers) {
    if (p.is_subscribed && p.subscription_tier && subCounts[p.subscription_tier] !== undefined) {
      subCounts[p.subscription_tier]++;
    }
  }
  const totalSubscribed = Object.values(subCounts).reduce((a, b) => a + b, 0);
  const monthlyRevenue  = Object.entries(subCounts).reduce(
    (sum, [tier, count]) => sum + count * (SUB_PRICES[tier] ?? 0), 0,
  );

  // ── City activity (last 30 days) ──────────────────────────────────────────
  const cityCount: Record<string, number> = {};
  for (const r of requests30) {
    if (r.city) cityCount[r.city] = (cityCount[r.city] ?? 0) + 1;
  }
  const topCities = Object.entries(cityCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxCityVal = topCities[0]?.[1] ?? 1;

  // ── Category demand ───────────────────────────────────────────────────────
  const catCount: Record<string, number> = {};
  for (const r of requests30) {
    if (r.category_slug) catCount[r.category_slug] = (catCount[r.category_slug] ?? 0) + 1;
  }
  const topCats = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxCatVal = topCats[0]?.[1] ?? 1;

  // ── Request completion rate ───────────────────────────────────────────────
  const completedReqs = requests30.filter((r: any) => r.status === 'completed').length;
  const completionPct = requests30.length > 0
    ? Math.round((completedReqs / requests30.length) * 100)
    : 0;

  // ── New user breakdown (30 days) ──────────────────────────────────────────
  const newClients   = usersAll.filter((u: any) => u.role === 'client').length;
  const newProviders = usersAll.filter((u: any) => u.role === 'provider').length;

  // ── Contract revenue estimate ─────────────────────────────────────────────
  const activeContracts = contracts.filter((c: any) => c.status === 'active');
  const contractRevEst  = activeContracts.reduce((sum: number, c: any) => {
    const vpm = c.frequency === 'weekly' ? 4 : c.frequency === 'biweekly' ? 2 : 1;
    return sum + (c.price_per_visit ?? 0) * vpm;
  }, 0);

  // ── Avg request suggested price ───────────────────────────────────────────
  const priced = requests30.filter((r: any) => r.ai_suggested_price_min && r.ai_suggested_price_max);
  const avgPrice = priced.length > 0
    ? Math.round(priced.reduce((s: number, r: any) =>
        s + ((r.ai_suggested_price_min + r.ai_suggested_price_max) / 2), 0) / priced.length)
    : 0;

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">التقارير والتحليلات</h1>
        <p className="text-slate-500 text-sm mt-0.5">آخر 30 يوم</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'إيراد الاشتراكات / شهر', value: fmtMoney(monthlyRevenue), sub: `${totalSubscribed} مشترك`, cls: 'text-amber-400' },
          { label: 'إيراد العقود / شهر (تقديري)', value: fmtMoney(contractRevEst), sub: `${activeContracts.length} عقد نشط`, cls: 'text-emerald-400' },
          { label: 'طلبات مكتملة', value: `${completionPct}%`, sub: `${completedReqs} من ${requests30.length}`, cls: 'text-sky-400' },
          { label: 'متوسط سعر الطلب', value: avgPrice ? fmtMoney(avgPrice) : '—', sub: `${priced.length} طلب بسعر مقترح`, cls: 'text-violet-400' },
        ].map(({ label, value, sub, cls }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-right">
            <div className={`text-2xl font-bold ${cls}`}>{value}</div>
            <div className="text-slate-500 text-xs mt-1">{sub}</div>
            <div className="text-slate-400 text-sm mt-2">{label}</div>
          </div>
        ))}
      </div>

      {/* Two-col: Subscription breakdown + New users */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Subscription breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-slate-200 font-semibold mb-4">توزيع الاشتراكات</h2>
          <div className="space-y-3">
            {(['basic', 'pro', 'premium'] as const).map(tier => {
              const count = subCounts[tier];
              const pct   = totalSubscribed > 0 ? Math.round((count / totalSubscribed) * 100) : 0;
              const rev   = count * SUB_PRICES[tier];
              const barClr = tier === 'premium' ? 'bg-violet-500' : tier === 'pro' ? 'bg-amber-500' : 'bg-slate-500';
              return (
                <div key={tier}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-500 text-xs">{fmtMoney(rev)}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs">{count} مزود</span>
                      <span className="text-slate-200 text-sm font-medium">{SUB_LABEL[tier]}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${barClr} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {totalSubscribed === 0 && (
              <p className="text-slate-600 text-sm text-center py-4">لا يوجد مشتركون بعد</p>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
            <span className="text-amber-400 font-bold">{fmtMoney(monthlyRevenue)}</span>
            <span className="text-slate-500 text-sm">إجمالي الإيراد الشهري</span>
          </div>
        </div>

        {/* New users last 30 days */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-slate-200 font-semibold mb-4">مستخدمون جدد (30 يوم)</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
              <span className="text-sky-400 font-bold text-xl">{newClients}</span>
              <div className="text-right">
                <div className="text-slate-200 text-sm">عملاء جدد</div>
                <div className="text-slate-500 text-xs">يبحثون عن خدمات</div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
              <span className="text-emerald-400 font-bold text-xl">{newProviders}</span>
              <div className="text-right">
                <div className="text-slate-200 text-sm">مزودون جدد</div>
                <div className="text-slate-500 text-xs">يقدمون خدمات</div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <span className="text-amber-400 font-bold text-xl">{usersAll.length}</span>
              <div className="text-right">
                <div className="text-slate-200 text-sm">إجمالي التسجيلات</div>
                <div className="text-slate-500 text-xs">آخر 30 يوم</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* City activity chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-slate-200 font-semibold mb-5">أكثر المدن نشاطاً (طلبات)</h2>
        {topCities.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-4">لا توجد بيانات بعد</p>
        ) : (
          <div className="space-y-3">
            {topCities.map(([city, count]) => {
              const pct = Math.round((count / maxCityVal) * 100);
              return (
                <div key={city} className="flex items-center gap-4">
                  <div className="w-20 text-right text-slate-300 text-sm shrink-0">{city}</div>
                  <div className="flex-1 h-6 bg-slate-800 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-amber-600/80 to-amber-400/80 rounded-lg transition-all"
                      style={{ width: `${pct}%` }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 text-xs text-slate-300">
                      {count} طلب
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Category demand */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-slate-200 font-semibold mb-5">أكثر الفئات طلباً</h2>
        {topCats.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-4">لا توجد بيانات بعد</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {topCats.map(([slug, count], i) => {
              const pct = Math.round((count / maxCatVal) * 100);
              const color = i === 0
                ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
                : i === 1
                ? 'text-sky-400 border-sky-500/40 bg-sky-500/10'
                : 'text-slate-400 border-slate-700 bg-slate-800/50';
              return (
                <div key={slug} className={`border rounded-xl p-3 ${color}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-lg">{count}</span>
                    <span className="text-xs text-right leading-tight opacity-80">
                      {slug.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">
                    <div className="h-full bg-current rounded-full opacity-60" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Request completion funnel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-slate-200 font-semibold mb-4">قمع الطلبات (30 يوم)</h2>
        <div className="space-y-2">
          {[
            { label: 'طلبات مستلمة',   count: requests30.length,                                                             cls: 'bg-sky-500' },
            { label: 'وصلت عروضاً',    count: requests30.filter((r: any) => r.status !== 'open').length,                     cls: 'bg-violet-500' },
            { label: 'قيد التنفيذ',    count: requests30.filter((r: any) => r.status === 'in_progress').length,              cls: 'bg-amber-500' },
            { label: 'مكتملة',          count: completedReqs,                                                                 cls: 'bg-emerald-500' },
          ].map(({ label, count, cls }) => {
            const pct = requests30.length > 0 ? Math.round((count / requests30.length) * 100) : 0;
            return (
              <div key={label} className="flex items-center gap-4">
                <div className="w-28 text-right text-slate-400 text-xs shrink-0">{label}</div>
                <div className="flex-1 h-5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${cls} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
                <div className="w-16 text-left text-slate-400 text-xs shrink-0">{count} ({pct}%)</div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
