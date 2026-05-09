import { supabaseAdmin } from '../lib/supabase';
import { Badge } from '../ui/badge';
import { ContractActions } from './contract-actions';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-JO', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const FREQ_LABEL: Record<string, string> = {
  weekly:   'أسبوعي',
  biweekly: 'كل أسبوعين',
  monthly:  'شهري',
};

const STATUS_META: Record<string, { label: string; variant: 'info' | 'success' | 'warning' | 'muted' | 'danger' }> = {
  bidding:   { label: 'بانتظار عروض', variant: 'info' },
  active:    { label: 'نشط',          variant: 'success' },
  paused:    { label: 'موقوف',        variant: 'warning' },
  completed: { label: 'منتهي',        variant: 'muted' },
  cancelled: { label: 'ملغي',         variant: 'danger' },
};

const FILTER_OPTIONS = [
  { value: '',          label: 'الكل' },
  { value: 'bidding',   label: 'بانتظار عروض' },
  { value: 'active',    label: 'نشط' },
  { value: 'paused',    label: 'موقوف' },
  { value: 'completed', label: 'منتهي' },
  { value: 'cancelled', label: 'ملغي' },
];

async function getContracts(page: number, status?: string) {
  let q = supabaseAdmin
    .from('recurring_contracts')
    .select(`
      id, title, city, category_slug, frequency, duration_months,
      price_per_visit, status, completed_visits, starts_at, created_at,
      client:users!client_id(full_name),
      contract_bids(id),
      provider:users!provider_id(full_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (status) q = q.eq('status', status);

  const { data, count } = await q;
  return { contracts: data ?? [], total: count ?? 0 };
}

async function getStats() {
  const [bidding, active, completed, activeRows] = await Promise.all([
    supabaseAdmin.from('recurring_contracts').select('id', { count: 'exact', head: true }).eq('status', 'bidding'),
    supabaseAdmin.from('recurring_contracts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('recurring_contracts').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    // Fetch frequency + duration of ALL active contracts for totalVisitsScheduled
    supabaseAdmin.from('recurring_contracts').select('frequency, duration_months').eq('status', 'active'),
  ]);

  const totalVisitsScheduled = (activeRows.data ?? []).reduce((sum: number, c: any) => {
    const visitsPerMonth = c.frequency === 'weekly' ? 4 : c.frequency === 'biweekly' ? 2 : 1;
    return sum + visitsPerMonth * c.duration_months;
  }, 0);

  return {
    bidding:  bidding.count  ?? 0,
    active:   active.count   ?? 0,
    completed: completed.count ?? 0,
    totalVisitsScheduled,
  };
}

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp   = await searchParams;
  const page = Math.max(0, parseInt(sp.page ?? '0', 10));

  const [{ contracts, total }, stats] = await Promise.all([
    getContracts(page, sp.status),
    getStats(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const pageUrl = (p: number) => {
    const params = new URLSearchParams({ ...(sp.status ? { status: sp.status } : {}), page: String(p) });
    if (params.get('page') === '0') params.delete('page');
    return `/contracts?${params}`;
  };

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">العقود الدورية</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} عقد</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'بانتظار عروض',  value: stats.bidding,              cls: 'text-sky-400' },
            { label: 'نشط',           value: stats.active,               cls: 'text-emerald-400' },
            { label: 'منتهي',         value: stats.completed,            cls: 'text-slate-500' },
            { label: 'زيارات مجدولة', value: stats.totalVisitsScheduled, cls: 'text-amber-400' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-right">
              <div className={`text-lg font-bold ${cls}`}>{value}</div>
              <div className="text-xs text-slate-600">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_OPTIONS.map(opt => (
          <a
            key={opt.value}
            href={opt.value ? `/contracts?status=${opt.value}` : '/contracts'}
            className={`text-sm px-4 py-2 rounded-lg transition-colors ${
              (sp.status ?? '') === opt.value
                ? 'bg-amber-400/15 text-amber-400 border border-amber-500/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            {opt.label}
          </a>
        ))}
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-800 text-right bg-slate-900/80">
                <th className="px-5 py-3 text-slate-500 font-medium">العقد</th>
                <th className="px-5 py-3 text-slate-500 font-medium">العميل</th>
                <th className="px-5 py-3 text-slate-500 font-medium">المزود</th>
                <th className="px-5 py-3 text-slate-500 font-medium">المدينة</th>
                <th className="px-5 py-3 text-slate-500 font-medium">التكرار</th>
                <th className="px-5 py-3 text-slate-500 font-medium">المدة</th>
                <th className="px-5 py-3 text-slate-500 font-medium">سعر الزيارة</th>
                <th className="px-5 py-3 text-slate-500 font-medium">العروض</th>
                <th className="px-5 py-3 text-slate-500 font-medium">الزيارات</th>
                <th className="px-5 py-3 text-slate-500 font-medium">الحالة</th>
                <th className="px-5 py-3 text-slate-500 font-medium">التاريخ</th>
                <th className="px-5 py-3 text-slate-500 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 && (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-slate-600">لا توجد عقود</td>
                </tr>
              )}
              {contracts.map((c: any) => {
                const st = STATUS_META[c.status] ?? STATUS_META.bidding;
                const bidsCount = Array.isArray(c.contract_bids) ? c.contract_bids.length : 0;
                const visitsPerMonth = c.frequency === 'weekly' ? 4 : c.frequency === 'biweekly' ? 2 : 1;
                const totalVisits = visitsPerMonth * c.duration_months;

                return (
                  <tr key={c.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors text-right">
                    <td className="px-5 py-3 max-w-[180px]">
                      <p className="text-slate-200 font-medium truncate">{c.title}</p>
                      <p className="text-xs text-emerald-500/70">{c.category_slug?.replace(/_/g,' ')}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{c.client?.full_name ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{c.provider?.full_name ?? <span className="text-slate-700">—</span>}</td>
                    <td className="px-5 py-3 text-slate-400">{c.city}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{FREQ_LABEL[c.frequency] ?? c.frequency}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{c.duration_months} شهر</td>
                    <td className="px-5 py-3 text-amber-400 font-semibold text-xs">
                      {c.price_per_visit ? `${c.price_per_visit} د.أ` : <span className="text-slate-700">—</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-300 font-bold">{bidsCount}</td>
                    <td className="px-5 py-3 text-xs text-slate-400">
                      {c.completed_visits ?? 0}<span className="text-slate-600">/{totalVisits}</span>
                    </td>
                    <td className="px-5 py-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{fmtDate(c.created_at)}</td>
                    <td className="px-5 py-3">
                      <ContractActions contractId={c.id} title={c.title} status={c.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-800 px-5 py-3 flex items-center justify-between">
            <span className="text-slate-500 text-xs">صفحة {page + 1} من {totalPages} · {total} عقد</span>
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
  );
}
