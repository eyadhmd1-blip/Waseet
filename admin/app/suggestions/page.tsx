import { supabaseAdmin } from '../lib/supabase';
import { SuggestionActions } from './suggestion-actions';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

async function getSuggestions(status: StatusFilter) {
  let q = supabaseAdmin
    .from('service_suggestions')
    .select('id, user_id, service_name, category_hint, status, admin_note, created_at, reviewed_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (status !== 'all') q = q.eq('status', status);
  const { data } = await q;
  return data ?? [];
}

async function getUserNames(userIds: string[]) {
  if (userIds.length === 0) return {};
  const { data } = await supabaseAdmin
    .from('users')
    .select('id, full_name, role')
    .in('id', userIds);
  return Object.fromEntries((data ?? []).map((u: any) => [u.id, u]));
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-JO', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const STATUS_LABEL: Record<string, string> = {
  pending:  'قيد المراجعة',
  approved: 'تمت الموافقة',
  rejected: 'مرفوض',
};

const STATUS_CLS: Record<string, string> = {
  pending:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export default async function SuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp     = await searchParams;
  const filter = (sp.status ?? 'pending') as StatusFilter;
  const rows   = await getSuggestions(filter);
  const users  = await getUserNames([...new Set(rows.map((r: any) => r.user_id))]);

  const counts = {
    pending:  0,
    approved: 0,
    rejected: 0,
    all:      rows.length,
  };

  const counts2 = await Promise.all([
    supabaseAdmin.from('service_suggestions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('service_suggestions').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabaseAdmin.from('service_suggestions').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
  ]);
  const [pend, appr, rej] = counts2;

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap" dir="rtl">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">اقتراحات الخدمات</h1>
          <p className="text-slate-500 text-sm mt-0.5">اقتراحات المستخدمين لخدمات غير موجودة في التطبيق</p>
        </div>
        <div className="flex gap-3">
          {[
            { label: 'قيد المراجعة', count: pend.count ?? 0,  cls: 'text-amber-400'   },
            { label: 'تمت الموافقة', count: appr.count ?? 0,  cls: 'text-emerald-400' },
            { label: 'مرفوض',        count: rej.count  ?? 0,  cls: 'text-red-400'     },
          ].map(({ label, count, cls }) => (
            <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-right">
              <div className={`text-lg font-bold ${cls}`}>{count}</div>
              <div className="text-xs text-slate-600">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2" dir="rtl">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
          <a
            key={s}
            href={`?status=${s}`}
            className={`text-sm px-4 py-2 rounded-lg transition-colors ${
              filter === s
                ? 'bg-amber-400/15 text-amber-400 border border-amber-500/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            {s === 'pending' ? 'قيد المراجعة' : s === 'approved' ? 'تمت الموافقة' : s === 'rejected' ? 'مرفوض' : 'الكل'}
          </a>
        ))}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <p className="text-slate-600">لا توجد اقتراحات</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-right">
                <th className="px-5 py-3 text-slate-500 font-medium">المستخدم</th>
                <th className="px-5 py-3 text-slate-500 font-medium">الخدمة المقترحة</th>
                <th className="px-5 py-3 text-slate-500 font-medium">التصنيف المقترح</th>
                <th className="px-5 py-3 text-slate-500 font-medium">التاريخ</th>
                <th className="px-5 py-3 text-slate-500 font-medium">الحالة</th>
                <th className="px-5 py-3 text-slate-500 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((row: any) => {
                const user = users[row.user_id];
                return (
                  <tr key={row.id} className="hover:bg-slate-800/40 transition-colors text-right">
                    <td className="px-5 py-3">
                      <p className="text-slate-200 font-medium">{user?.full_name ?? '—'}</p>
                      <p className="text-slate-600 text-xs">{user?.role === 'provider' ? 'مزود' : 'عميل'}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-slate-200 font-medium">{row.service_name}</p>
                      {row.admin_note && (
                        <p className="text-slate-600 text-xs mt-0.5">ملاحظة: {row.admin_note}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs">
                      {row.category_hint ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs">
                      {fmtDate(row.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs border rounded-lg px-2 py-0.5 ${STATUS_CLS[row.status]}`}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {row.status === 'pending' ? (
                        <SuggestionActions
                          id={row.id}
                          userId={row.user_id}
                          serviceName={row.service_name}
                        />
                      ) : (
                        <span className="text-slate-700 text-xs">
                          {row.reviewed_at ? fmtDate(row.reviewed_at) : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
