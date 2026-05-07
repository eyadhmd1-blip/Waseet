import { supabaseAdmin } from '../lib/supabase';
import { Badge } from '../ui/badge';
import { RequestActions } from './request-actions';

export const dynamic = 'force-dynamic';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-JO', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const REQ_STATUS: Record<string, { label: string; variant: 'info' | 'warning' | 'success' | 'muted' }> = {
  open:        { label: 'مفتوح', variant: 'info' },
  in_progress: { label: 'جارٍ',  variant: 'warning' },
  completed:   { label: 'منجز',  variant: 'success' },
  cancelled:   { label: 'ملغي',  variant: 'muted' },
};

async function getRequests() {
  const { data } = await supabaseAdmin
    .from('requests')
    .select(`
      id, title, city, status, created_at, category_slug,
      ai_suggested_price_min, ai_suggested_price_max, is_urgent,
      client:users(full_name),
      bids(id)
    `)
    .order('created_at', { ascending: false })
    .limit(200);
  return data ?? [];
}

export default async function RequestsPage() {
  const requests = await getRequests();

  const open        = requests.filter((r: any) => r.status === 'open').length;
  const inProgress  = requests.filter((r: any) => r.status === 'in_progress').length;
  const completed   = requests.filter((r: any) => r.status === 'completed').length;
  const cancelled   = requests.filter((r: any) => r.status === 'cancelled').length;
  const urgent      = requests.filter((r: any) => r.is_urgent).length;

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">إدارة الطلبات</h1>
          <p className="text-slate-500 text-sm mt-0.5">{requests.length} طلب</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'مفتوح',   value: open,       cls: 'text-sky-400' },
            { label: 'جارٍ',    value: inProgress, cls: 'text-amber-400' },
            { label: 'منجز',    value: completed,  cls: 'text-emerald-400' },
            { label: 'ملغي',    value: cancelled,  cls: 'text-slate-500' },
            { label: '🚨 طارئ', value: urgent,     cls: 'text-red-400' },
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
                <th className="px-5 py-3 text-slate-500 font-medium">الطلب</th>
                <th className="px-5 py-3 text-slate-500 font-medium">العميل</th>
                <th className="px-5 py-3 text-slate-500 font-medium">التصنيف</th>
                <th className="px-5 py-3 text-slate-500 font-medium">المدينة</th>
                <th className="px-5 py-3 text-slate-500 font-medium">العروض</th>
                <th className="px-5 py-3 text-slate-500 font-medium">السعر المقترح</th>
                <th className="px-5 py-3 text-slate-500 font-medium">الحالة</th>
                <th className="px-5 py-3 text-slate-500 font-medium">التاريخ</th>
                <th className="px-5 py-3 text-slate-500 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-600">لا توجد طلبات بعد</td>
                </tr>
              )}
              {requests.map((r: any) => {
                const st        = REQ_STATUS[r.status] ?? REQ_STATUS.open;
                const bidsCount = Array.isArray(r.bids) ? r.bids.length : 0;
                const hasPrice  = r.ai_suggested_price_min && r.ai_suggested_price_max;
                const stalled   = r.status === 'open' && bidsCount === 0 &&
                  (Date.now() - new Date(r.created_at).getTime()) > 48 * 3600 * 1000;

                return (
                  <tr
                    key={r.id}
                    className={`border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors text-right
                      ${stalled ? 'bg-red-950/20' : ''}`}
                  >
                    <td className="px-5 py-3 max-w-[220px]">
                      <div className="flex items-center gap-1.5 flex-row-reverse justify-end">
                        {r.is_urgent && <span className="text-red-400 text-xs shrink-0">🚨</span>}
                        {stalled    && <span className="text-orange-400 text-xs shrink-0" title="راكد">⚠️</span>}
                        <p className="text-slate-200 font-medium truncate">{r.title}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{r.client?.full_name ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{r.category_slug?.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3 text-slate-400">{r.city}</td>
                    <td className="px-5 py-3">
                      <span className={`text-sm font-bold ${bidsCount === 0 && r.status === 'open' ? 'text-red-400' : 'text-slate-300'}`}>
                        {bidsCount}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {hasPrice
                        ? `${r.ai_suggested_price_min}–${r.ai_suggested_price_max} د.أ`
                        : <span className="text-slate-700">—</span>
                      }
                    </td>
                    <td className="px-5 py-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{fmtDate(r.created_at)}</td>
                    <td className="px-5 py-3">
                      <RequestActions requestId={r.id} title={r.title} status={r.status} />
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
