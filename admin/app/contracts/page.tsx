import { supabaseAdmin } from '../lib/supabase';
import { Badge } from '../ui/badge';

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

async function getContracts() {
  const { data } = await supabaseAdmin
    .from('recurring_contracts')
    .select(`
      id, title, city, category_slug, frequency, duration_months,
      price_per_visit, status, completed_visits, starts_at, created_at,
      client:users(full_name),
      contract_bids(id),
      provider:users!provider_id(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(150);
  return data ?? [];
}

export default async function ContractsPage() {
  const contracts = await getContracts();

  const bidding   = contracts.filter((c: any) => c.status === 'bidding').length;
  const active    = contracts.filter((c: any) => c.status === 'active').length;
  const completed = contracts.filter((c: any) => c.status === 'completed').length;

  const totalVisitsScheduled = contracts
    .filter((c: any) => c.status === 'active')
    .reduce((sum: number, c: any) => {
      const visitsPerMonth = c.frequency === 'weekly' ? 4 : c.frequency === 'biweekly' ? 2 : 1;
      return sum + visitsPerMonth * c.duration_months;
    }, 0);

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">العقود الدورية</h1>
          <p className="text-slate-500 text-sm mt-0.5">{contracts.length} عقد</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'بانتظار عروض',    value: bidding,              cls: 'text-sky-400' },
            { label: 'نشط',              value: active,               cls: 'text-emerald-400' },
            { label: 'منتهي',            value: completed,            cls: 'text-slate-500' },
            { label: 'زيارات مجدولة',   value: totalVisitsScheduled, cls: 'text-amber-400' },
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
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-slate-600">لا توجد عقود بعد</td>
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
