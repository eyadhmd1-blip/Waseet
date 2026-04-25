import { supabaseAdmin } from '../lib/supabase';
import { Badge } from '../ui/badge';
import { ProviderActions } from './provider-actions';

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

async function getProviders() {
  const { data } = await supabaseAdmin
    .from('providers')
    .select(`
      id, score, reputation_tier, lifetime_jobs,
      is_subscribed, subscription_tier, subscription_ends,
      badge_verified, loyalty_discount, created_at,
      is_active, suspended_at, suspension_reason,
      bid_credits,
      user:users(id, full_name, phone, city, is_disabled)
    `)
    .order('lifetime_jobs', { ascending: false });
  return data ?? [];
}

export default async function ProvidersPage() {
  const providers = await getProviders();

  const subscribed  = providers.filter((p: any) => p.is_subscribed).length;
  const verified    = providers.filter((p: any) => p.badge_verified).length;
  const suspended   = providers.filter((p: any) => !p.is_active).length;
  const avgScore    = providers.length > 0
    ? (providers.reduce((s: number, p: any) => s + Number(p.score ?? 0), 0) / providers.length).toFixed(1)
    : '—';

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">إدارة المزودين</h1>
          <p className="text-slate-500 text-sm mt-0.5">{providers.length} مزود مسجّل</p>
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
                  <td colSpan={9} className="text-center py-12 text-slate-600">لا يوجد مزودون بعد</td>
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
        </div>
      </div>
    </div>
  );
}
