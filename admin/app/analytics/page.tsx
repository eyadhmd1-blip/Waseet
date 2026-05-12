import { supabaseAdmin } from '../lib/supabase';

export const dynamic = 'force-dynamic';

async function getAnalyticsData() {
  const [
    { data: providersRaw },
    { data: openRequests },
    { data: categories },
  ] = await Promise.all([
    supabaseAdmin
      .from('providers')
      .select('categories, user:users(city)'),
    supabaseAdmin
      .from('requests')
      .select('city, category_slug')
      .eq('status', 'open'),
    supabaseAdmin
      .from('service_categories')
      .select('slug, name_ar')
      .order('sort_order'),
  ]);

  return {
    providers:    providersRaw  ?? [],
    openRequests: openRequests  ?? [],
    categories:   categories    ?? [],
  };
}

export default async function AnalyticsPage() {
  const { providers, openRequests, categories } = await getAnalyticsData();

  // ── City supply vs demand ─────────────────────────────────────────────────
  const citySupply: Record<string, number> = {};
  for (const p of providers) {
    const city = (p.user as any)?.city;
    if (city) citySupply[city] = (citySupply[city] ?? 0) + 1;
  }

  const cityDemand: Record<string, number> = {};
  for (const r of openRequests) {
    if (r.city) cityDemand[r.city] = (cityDemand[r.city] ?? 0) + 1;
  }

  const allCities = Array.from(new Set([...Object.keys(citySupply), ...Object.keys(cityDemand)]));
  const cityData = allCities
    .map(city => ({
      city,
      supply: citySupply[city] ?? 0,
      demand: cityDemand[city] ?? 0,
    }))
    .sort((a, b) => (b.supply + b.demand) - (a.supply + a.demand))
    .slice(0, 8);
  const maxCityVal = Math.max(...cityData.map(c => Math.max(c.supply, c.demand)), 1);

  // ── Category supply vs demand ─────────────────────────────────────────────
  const catDemand: Record<string, number> = {};
  for (const r of openRequests) {
    if (r.category_slug) catDemand[r.category_slug] = (catDemand[r.category_slug] ?? 0) + 1;
  }

  const catSupply: Record<string, number> = {};
  for (const p of providers) {
    for (const cat of ((p.categories as string[]) ?? [])) {
      catSupply[cat] = (catSupply[cat] ?? 0) + 1;
    }
  }

  const catNameMap: Record<string, string> = {};
  for (const c of categories) catNameMap[c.slug] = c.name_ar;

  const allCatSlugs = Array.from(new Set([...Object.keys(catDemand), ...Object.keys(catSupply)]));
  const catData = allCatSlugs
    .map(slug => ({
      slug,
      name: catNameMap[slug] ?? slug.replace(/_/g, ' '),
      supply: catSupply[slug] ?? 0,
      demand: catDemand[slug] ?? 0,
    }))
    .filter(c => c.demand > 0 || c.supply > 0)
    .sort((a, b) => (b.demand + b.supply) - (a.demand + a.supply))
    .slice(0, 10);
  const maxCatVal = Math.max(...catData.map(c => Math.max(c.supply, c.demand)), 1);

  const demandRatio = providers.length > 0
    ? (openRequests.length / providers.length).toFixed(1)
    : '—';
  const ratioHigh = providers.length > 0 && openRequests.length / providers.length > 2;

  return (
    <div className="p-6 space-y-6" dir="rtl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">تحليلات العرض والطلب</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          مقارنة المقدمين المتاحين (العرض) مع الطلبات المفتوحة (الطلب) — لحظي
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { icon: '🔧', label: 'إجمالي المقدمين',      value: providers.length,    color: 'text-blue-400'    },
          { icon: '📋', label: 'طلبات مفتوحة',         value: openRequests.length, color: 'text-amber-400'   },
          { icon: '🏙️', label: 'مدن نشطة',              value: allCities.length,    color: 'text-emerald-400' },
          { icon: '⚖️', label: 'نسبة الطلب / العرض',   value: `${demandRatio}x`,   color: ratioHigh ? 'text-red-400' : 'text-emerald-400' },
        ] as const).map(({ icon, label, value, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-right">
            <div className="text-2xl mb-1">{icon}</div>
            <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
            <div className="text-slate-500 text-xs mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* City Supply vs Demand */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-slate-200 font-semibold mb-1">العرض مقابل الطلب — حسب المدينة</h2>
        <div className="flex items-center gap-4 mb-5">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: '#3B82F6' }} />
            <span className="text-slate-500 text-xs">مقدمون (العرض)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: '#F59E0B' }} />
            <span className="text-slate-500 text-xs">طلبات مفتوحة (الطلب)</span>
          </div>
        </div>
        {cityData.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-6">لا توجد بيانات بعد</p>
        ) : (
          <div className="space-y-4">
            {cityData.map(({ city, supply, demand }) => {
              const supplyPct = Math.round((supply / maxCityVal) * 100);
              const demandPct = Math.round((demand / maxCityVal) * 100);
              const shortage  = demand > supply * 1.5;
              return (
                <div key={city}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {shortage && <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">⚠️ نقص</span>}
                      <span className="text-slate-600 text-xs">ع:{supply} · ط:{demand}</span>
                    </div>
                    <span className="text-slate-200 text-sm font-medium">{city}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${supplyPct}%`, background: 'linear-gradient(90deg,#2563EB,#60A5FA)' }} />
                    </div>
                    <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${demandPct}%`, background: 'linear-gradient(90deg,#D97706,#FCD34D)' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Category Supply vs Demand */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-slate-200 font-semibold mb-1">العرض مقابل الطلب — حسب الفئة</h2>
        <div className="flex items-center gap-4 mb-5">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: '#3B82F6' }} />
            <span className="text-slate-500 text-xs">مقدمون في الفئة</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: '#F59E0B' }} />
            <span className="text-slate-500 text-xs">طلبات مفتوحة في الفئة</span>
          </div>
        </div>
        {catData.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-6">لا توجد بيانات بعد</p>
        ) : (
          <div className="space-y-4">
            {catData.map(({ slug, name, supply, demand }) => {
              const supplyPct = Math.round((supply / maxCatVal) * 100);
              const demandPct = Math.round((demand / maxCatVal) * 100);
              const hot = demand > supply;
              return (
                <div key={slug}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {hot && <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">🔥 طلب عالٍ</span>}
                      <span className="text-slate-600 text-xs">ع:{supply} · ط:{demand}</span>
                    </div>
                    <span className="text-slate-200 text-sm font-medium">{name}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${supplyPct}%`, background: 'linear-gradient(90deg,#2563EB,#60A5FA)' }} />
                    </div>
                    <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full"
                        style={{ width: `${demandPct}%`, background: 'linear-gradient(90deg,#D97706,#FCD34D)' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary: shortage cities + hot categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Shortage cities */}
        <div className="bg-slate-900 rounded-2xl p-5"
          style={{ border: '1px solid rgba(239,68,68,0.20)' }}>
          <h2 className="text-red-400 font-semibold mb-3">⚠️ مدن بها نقص مقدمين</h2>
          {cityData.filter(c => c.demand > c.supply * 1.5).length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-3">لا توجد مدن بنقص حالياً ✅</p>
          ) : (
            <div className="space-y-2">
              {cityData.filter(c => c.demand > c.supply * 1.5).map(c => (
                <div key={c.city}
                  className="flex items-center justify-between p-2.5 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.14)' }}>
                  <span className="text-red-400 text-sm font-bold">+{c.demand - c.supply} طلب بلا تغطية</span>
                  <span className="text-slate-200 text-sm">{c.city}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hot demand categories */}
        <div className="bg-slate-900 rounded-2xl p-5"
          style={{ border: '1px solid rgba(245,158,11,0.20)' }}>
          <h2 className="text-amber-400 font-semibold mb-3">🔥 فئات ذات طلب مرتفع</h2>
          {catData.filter(c => c.demand > c.supply).length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-3">العرض يغطي الطلب في كل الفئات ✅</p>
          ) : (
            <div className="space-y-2">
              {catData.filter(c => c.demand > c.supply).slice(0, 5).map(c => (
                <div key={c.slug}
                  className="flex items-center justify-between p-2.5 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.14)' }}>
                  <span className="text-amber-400 text-sm font-bold">+{c.demand - c.supply} طلب إضافي</span>
                  <span className="text-slate-200 text-sm">{c.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
