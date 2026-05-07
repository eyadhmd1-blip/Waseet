import { supabaseAdmin } from '../lib/supabase';
import { Badge } from '../ui/badge';
import { ProviderActions } from './provider-actions';
import { FilterBar } from '../ui/filter-bar';
import type { FilterConfig } from '../ui/filter-bar';

export const dynamic = 'force-dynamic';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-JO', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const TIER_META: Record<string, { label: string; variant: 'muted' | 'info' | 'warning' | 'violet' | 'danger' }> = {
  new:     { label: 'جديد',   variant: 'muted' },
  rising:  { label: 'صاعد',   variant: 'info' },
  trusted: { label: 'موثوق',  variant: 'warning' },
  expert:  { label: 'خبير',   variant: 'violet' },
  elite:   { label: 'نخبة',   variant: 'danger' },
};

const SUB_META: Record<string, { label: string; variant: 'muted' | 'warning' | 'violet' }> = {
  basic:   { label: 'أساسية',  variant: 'muted' },
  pro:     { label: 'محترف',   variant: 'warning' },
  premium: { label: 'متميز',   variant: 'violet' },
};

const FILTERS: FilterConfig[] = [
  {
    key: 'status',
    label: 'الحالة',
    options: [
      { value: 'active',    label: 'نشط' },
      { value: 'suspended', label: 'موقوف' },
    ],
  },
  {
    key: 'tier',
    label: 'الرتبة',
    options: [
      { value: 'new',     label: 'جديد' },
      { value: 'rising',  label: 'صاعد' },
      { value: 'trusted', label: 'موثوق' },
      { value: 'expert',  label: 'خبير' },
      { value: 'elite',   label: 'نخبة' },
    ],
  },
  {
    key: 'sub',
    label: 'الاشتراك',
    options: [
      { value: 'none',    label: 'مجاني' },
      { value: 'basic',   label: 'أساسية' },
      { value: 'pro',     label: 'محترف' },
      { value: 'premium', label: 'متميز' },
    ],
  },
  {
    key: 'badge',
    label: 'الشارة',
    options: [
      { value: 'yes', label: 'موثّق' },
      { value: 'no',  label: 'غير موثّق' },
    ],
  },
];

const PAGE_SIZE = 50;

async function getProviders(params: {
  q?: string; status?: string; tier?: string; sub?: string; badge?: string; page: number;
}) {
  // Step 1: if text search, resolve matching user IDs first
  let userIds: string[] | null = null;
  if (params.q) {
    const { data: matchedUsers } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'provider')
      .or(`full_name.ilike.%${params.q}%,phone.ilike.%${params.q}%`);
    userIds = (matchedUsers ?? []).map((u: any) => u.id);
    if (userIds.length === 0) return { providers: [], total: 0 };
  }

  // Step 2: build provider query
  let query = supabaseAdmin
    .from('providers')
    .select(`
      id, score, reputation_tier, lifetime_jobs,
      is_subscribed, subscription_tier, subscription_ends,
      badge_verified, loyalty_discount, created_at,
      is_active, suspended_at, suspension_reason,
      bid_credits,
      user:users(id, full_name, phone, city, is_disabled)
    `, { count: 'exact' })
    .order('lifetime_jobs', { ascending: false })
    .range(params.page * PAGE_SIZE, (params.page + 1) * PAGE_SIZE - 1);

  if (userIds !== null) {
    query = query.in('user_id', userIds);
  }
  if (params.status === 'active')    query = query.eq('is_active', true);
  if (params.status === 'suspended') query = query.eq('is_active', false);
  if (params.tier)                   query = query.eq('reputation_tier', params.tier);
  if (params.badge === 'yes')        query = query.eq('badge_verified', true);
  if (params.badge === 'no')         query = query.eq('badge_verified', false);
  if (params.sub === 'none') {
    query = query.eq('is_subscribed', false);
  } else if (params.sub) {
    query = query.eq('is_subscribed', true).eq('subscription_tier', params.sub);
  }

  const { data, count } = await query;
  return { providers: data ?? [], total: count ?? 0 };
}

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; tier?: string; sub?: string; badge?: string; page?: string }>;
}) {
  const sp   = await searchParams;
  const page = Math.max(0, parseInt(sp.page ?? '0', 10));
  const { providers, total } = await getProviders({ ...sp, page });

  const subscribed = providers.filter((p: any) => p.is_subscribed).length;
  const verified   = providers.filter((p: any) => p.badge_verified).length;
  const suspended  = providers.filter((p: any) => !p.is_active).length;
  const avgScore   = providers.length > 0
    ? (providers.reduce((s: number, p: any) => s + Number(p.score ?? 0), 0) / providers.length).toFixed(1)
    : '—';
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const current: Record<string, string> = {
    q:      sp.q      ?? '',
    status: sp.status ?? '',
    tier:   sp.tier   ?? '',
    sub:    sp.sub    ?? '',
    badge:  sp.badge  ?? '',
  };

  const pageUrl = (p: number) => {
    const params = new URLSearchParams({ ...current, page: String(p) });
    return `/providers?${params}`;
  };

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">إدارة المزودين</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} مزود مسجّل</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'مشترك',   value: subscribed, cls: 'text-amber-400' },
            { label: 'موثّق',   value: verified,   cls: 'text-sky-400' },
            { label: 'موقوف',   value: suspended,  cls: 'text-red-400' },
            { label: 'متوسط التقييم', value: avgScore, cls: 'text-emerald-400' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-right">
              <div className={`text-lg font-bold ${cls}`}>{value}</div>
              <div className="text-xs text-slate-600">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Search & filter bar */}
      <FilterBar current={current} searchPlaceholder="بحث بالاسم أو الهاتف..." filters={FILTERS} />

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-800 text-right bg-slate-900/80">
                <th className="px-5 py-3 text-slate-500 font-medium">المزود</th>
                <th className="px-5 py-3 text-slate-500 font-medium">الرتبة</th>
                <th className="px-5 py-3 text-slate-500 font-medium">التقييم</th>
                <th className="px-5 py-3 text-slate-500 font-medium">الأعمال</th>
                <th className="px-5 py-3 text-slate-500 font-medium">الرصيد</th>
                <th className="px-5 py-3 text-slate-500 font-medium">الاشتراك</th>
                <th className="px-5 py-3 text-slate-500 font-medium">الحالة</th>
                <th className="px-5 py-3 text-slate-500 font-medium">انتهاء الاشتراك</th>
                <th className="px-5 py-3 text-slate-500 font-medium text-center">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {providers.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-600">لا توجد نتائج</td>
                </tr>
              )}
              {providers.map((p: any) => {
                const tier = TIER_META[p.reputation_tier] ?? TIER_META.new;
                const sub  = p.subscription_tier ? SUB_META[p.subscription_tier] : null;
                const user = p.user ?? {};

                return (
                  <tr
                    key={p.id}
                    className={`border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors text-right
                      ${!p.is_active ? 'opacity-60' : ''}`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3 flex-row-reverse">
                        <div className="w-8 h-8 rounded-full bg-violet-500/80 flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {user.full_name?.charAt(0) ?? '?'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-row-reverse">
                            <span className="text-slate-200 font-medium">{user.full_name}</span>
                            {p.badge_verified && <span className="text-sky-400 text-xs">✓</span>}
                          </div>
                          <div className="text-xs text-slate-500">{user.city} · {user.phone}</div>
                          {p.suspension_reason && (
                            <div className="text-xs text-red-400/70 mt-0.5 truncate max-w-[180px]" title={p.suspension_reason}>
                              {p.suspension_reason}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3"><Badge variant={tier.variant}>{tier.label}</Badge></td>
                    <td className="px-5 py-3 text-slate-300">
                      {p.score > 0 ? `⭐ ${Number(p.score).toFixed(1)}` : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-300 font-semibold">{p.lifetime_jobs}</td>
                    <td className="px-5 py-3">
                      <span className={`font-semibold text-sm ${(p.bid_credits ?? 0) > 0 ? 'text-violet-400' : 'text-slate-600'}`}>
                        {p.subscription_tier === 'premium'
                          ? <span className="text-amber-400 text-xs">∞</span>
                          : (p.bid_credits ?? 0)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {p.is_subscribed && sub
                        ? <Badge variant={sub.variant}>{sub.label}</Badge>
                        : <span className="text-slate-600 text-xs">مجاني</span>
                      }
                    </td>
                    <td className="px-5 py-3">
                      {p.is_active
                        ? <Badge variant="success">نشط</Badge>
                        : <Badge variant="danger">موقوف</Badge>
                      }
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs">
                      {p.subscription_ends ? fmtDate(p.subscription_ends) : <span className="text-slate-700">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <ProviderActions
                        providerId={p.id}
                        userId={user.id}
                        name={user.full_name ?? '?'}
                        isActive={p.is_active}
                        badgeVerified={p.badge_verified}
                        currentTier={p.reputation_tier}
                        bidCredits={p.bid_credits ?? 0}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-800 px-5 py-3 flex items-center justify-between">
            <span className="text-slate-500 text-xs">صفحة {page + 1} من {totalPages}</span>
            <div className="flex gap-2">
              {page > 0 && (
                <a href={pageUrl(page - 1)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors">السابق</a>
              )}
              {page < totalPages - 1 && (
                <a href={pageUrl(page + 1)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors">التالي</a>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
