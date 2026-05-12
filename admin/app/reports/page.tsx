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
    { data: boosts30 },
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
    supabaseAdmin
      .from('bids')
      .select('is_boosted, boosted_at, provider:providers(subscription_tier)')
      .eq('is_boosted', true)
      .gte('boosted_at', thirtyDaysAgo),
  ]);

  return {
    providers:  providers  ?? [],
    requests30: requests30 ?? [],
    usersAll:   usersAll   ?? [],
    contracts:  contracts  ?? [],
    boosts30:   boosts30   ?? [],
  };
}

export default async function ReportsPage() {
  const { providers, requests30, usersAll, contracts, boosts30 } = await getReportData();

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
    return sum + (c.price_per_visit ?? 0) * vpm * (c.duration_months ?? 1);
  }, 0);

  // ── Avg request suggested price ───────────────────────────────────────────
  const priced = requests30.filter((r: any) => r.ai_suggested_price_min && r.ai_suggested_price_max);
  const avgPrice = priced.length > 0
    ? Math.round(priced.reduce((s: number, r: any) =>
        s + ((r.ai_suggested_price_min + r.ai_suggested_price_max) / 2), 0) / priced.length)
    : 0;

  // ── Revenue Timeline — last 6 months (grouped by provider creation month) ───
  const nowDate = new Date();
  const revenueTimeline = Array.from({ length: 6 }, (_, i) => {
    const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth() - (5 - i), 1);
    const monthEnd   = new Date(nowDate.getFullYear(), nowDate.getMonth() - (5 - i) + 1, 1);
    const label = monthStart.toLocaleDateString('ar-JO', { month: 'short', year: '2-digit' });
    const monthProviders = providers.filter((p: any) => {
      const created = new Date(p.created_at);
      return created >= monthStart && created < monthEnd && p.is_subscribed;
    });
    const rev   = monthProviders.reduce((sum: number, p: any) => sum + (SUB_PRICES[p.subscription_tier ?? ''] ?? 0), 0);
    const count = monthProviders.length;
    return { label, rev, count };
  });
  const maxTimelineRev = Math.max(...revenueTimeline.map(m => m.rev), 1);

  // ── Bid Boost metrics (last 30 days) ─────────────────────────────────────
  const totalBoosts   = boosts30.length;
  const freeBoosts    = boosts30.filter((b: any) => b.provider?.subscription_tier === 'premium').length;
  const paidBoosts    = totalBoosts - freeBoosts;
  // avg credit value ≈ 0.25 JOD (basic 5/20=0.25, pro 12/50=0.24)
  const boostRevEst   = parseFloat((paidBoosts * 0.25).toFixed(2));

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">التقارير والتحليلات</h1>
        <p className="text-slate-500 text-sm mt-0.5">آخر 30 يوم</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'إيراد الاشتراكات / شهر', value: fmtMoney(monthlyRevenue), sub: `${totalSubscribed} مشترك`, cls: 'text-amber-400' },
          { label: 'إيراد العقود / شهر (تقديري)', value: fmtMoney(contractRevEst), sub: `${activeContracts.length} عقد نشط`, cls: 'text-emerald-400' },
          { label: 'تعزيزات العروض / شهر', value: String(totalBoosts), sub: `${paidBoosts} مدفوع · ${freeBoosts} مجاني (نخبة)`, cls: 'text-yellow-400' },
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
                      <span className="text-slate-400 text-xs">{count} مقدم</span>
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
                <div className="text-slate-200 text-sm">مقدمون جدد</div>
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

      {/* Revenue Timeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-slate-200 font-semibold">الإيراد الشهري — آخر 6 أشهر</h2>
            <p className="text-slate-500 text-xs mt-0.5">مبني على اشتراكات المقدمين المنضمين هذه الفترة</p>
          </div>
          <div className="text-right">
            <div className="text-amber-400 font-bold text-xl">{fmtMoney(monthlyRevenue)}</div>
            <div className="text-slate-600 text-xs mt-0.5">الإيراد الحالي / شهر</div>
          </div>
        </div>
        {revenueTimeline.every(m => m.rev === 0) ? (
          <p className="text-slate-600 text-sm text-center py-6">لا توجد بيانات اشتراك بعد</p>
        ) : (
          <div className="flex items-end gap-2" style={{ height: '120px' }} dir="ltr">
            {revenueTimeline.map(({ label, rev, count }) => {
              const heightPct = Math.max((rev / maxTimelineRev) * 100, 2);
              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-1">
                  {rev > 0 && (
                    <span className="text-[9px] text-amber-400 font-bold leading-tight text-center">
                      {fmtMoney(rev)}
                    </span>
                  )}
                  <div className="w-full relative flex-1">
                    <div className="absolute bottom-0 w-full rounded-t-lg transition-all"
                      style={{
                        height: `${heightPct}%`,
                        background: rev > 0
                          ? 'linear-gradient(180deg,rgba(245,158,11,0.9) 0%,rgba(217,119,6,0.65) 100%)'
                          : 'rgba(51,65,85,0.4)',
                      }} />
                  </div>
                  <div className="text-center mt-1">
                    <div className="text-[9px] text-slate-500">{label}</div>
                    {count > 0 && <div className="text-[8px] text-slate-700">{count} مشترك</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

      {/* Bid Boost analytics */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-slate-200 font-semibold mb-4">تعزيزات العروض — آخر 30 يوم</h2>
        {totalBoosts === 0 ? (
          <p className="text-slate-600 text-sm text-center py-4">لا توجد تعزيزات بعد</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col items-end p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <span className="text-yellow-400 font-bold text-2xl">⚡ {totalBoosts}</span>
              <span className="text-slate-400 text-sm mt-1">إجمالي التعزيزات</span>
            </div>
            <div className="flex flex-col items-end p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <span className="text-emerald-400 font-bold text-2xl">{paidBoosts}</span>
              <span className="text-slate-400 text-sm mt-1">تعزيزات مدفوعة (1 رصيد/تعزيز)</span>
              <span className="text-slate-500 text-xs mt-0.5">~{fmtMoney(boostRevEst)} (تقديري)</span>
            </div>
            <div className="flex flex-col items-end p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
              <span className="text-violet-400 font-bold text-2xl">{freeBoosts}</span>
              <span className="text-slate-400 text-sm mt-1">تعزيزات مجانية (نخبة)</span>
            </div>
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
