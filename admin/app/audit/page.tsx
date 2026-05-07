import { supabaseAdmin } from '../lib/supabase';
import { Badge } from '../ui/badge';

export const dynamic = 'force-dynamic';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-JO', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const ACTION_META: Record<string, { label: string; variant: 'danger' | 'success' | 'warning' | 'info' | 'muted' | 'violet' }> = {
  disable_user:           { label: 'تعطيل مستخدم',       variant: 'danger' },
  enable_user:            { label: 'تفعيل مستخدم',        variant: 'success' },
  suspend_provider:       { label: 'إيقاف مزود',          variant: 'danger' },
  unsuspend_provider:     { label: 'رفع إيقاف مزود',      variant: 'success' },
  verify_provider:        { label: 'توثيق مزود',          variant: 'info' },
  unverify_provider:      { label: 'إلغاء توثيق مزود',    variant: 'muted' },
  override_tier:          { label: 'تغيير رتبة',           variant: 'warning' },
  close_request:          { label: 'إغلاق طلب',           variant: 'warning' },
  delete_request:         { label: 'حذف طلب',             variant: 'danger' },
  broadcast_notification: { label: 'إشعار جماعي',         variant: 'violet' },
  update_setting:         { label: 'تحديث إعداد',         variant: 'info' },
};

const TARGET_ICON: Record<string, string> = {
  user:     '👤',
  provider: '🔧',
  request:  '📋',
  contract: '📄',
  system:   '⚙️',
};

async function getAuditLogs(params: {
  action?: string;
  target_type?: string;
  page: number;
}) {
  const PAGE_SIZE = 50;
  let query = supabaseAdmin
    .from('admin_audit_log')
    .select('id, action, target_type, target_label, reason, metadata, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(params.page * PAGE_SIZE, (params.page + 1) * PAGE_SIZE - 1);

  if (params.action)      query = query.eq('action',      params.action);
  if (params.target_type) query = query.eq('target_type', params.target_type);

  const { data, count } = await query;
  return { logs: data ?? [], total: count ?? 0, pageSize: PAGE_SIZE };
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; target?: string; page?: string }>;
}) {
  const sp         = await searchParams;
  const action     = sp.action     ?? '';
  const target     = sp.target     ?? '';
  const page       = Math.max(0, parseInt(sp.page ?? '0', 10));

  const { logs, total, pageSize } = await getAuditLogs({
    action:      action || undefined,
    target_type: target || undefined,
    page,
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">سجل المراجعة</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} حدث مسجّل</p>
        </div>
      </div>

      {/* Filters */}
      <form method="get" className="flex gap-3 flex-wrap">
        <select
          name="action"
          defaultValue={action}
          className="bg-slate-900 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400/50"
        >
          <option value="">كل الإجراءات</option>
          {Object.entries(ACTION_META).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <select
          name="target"
          defaultValue={target}
          className="bg-slate-900 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400/50"
        >
          <option value="">كل الأنواع</option>
          <option value="user">مستخدم</option>
          <option value="provider">مزود</option>
          <option value="request">طلب</option>
          <option value="contract">عقد</option>
          <option value="system">نظام</option>
        </select>

        <button type="submit" className="px-4 py-2 rounded-xl bg-amber-500 text-slate-900 text-sm font-bold">تصفية</button>
        {(action || target) && (
          <a
            href="/audit"
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-400 text-sm hover:bg-slate-700 transition-colors"
          >
            مسح
          </a>
        )}
      </form>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-800 text-right bg-slate-900/80">
                <th className="px-5 py-3 text-slate-500 font-medium">الإجراء</th>
                <th className="px-5 py-3 text-slate-500 font-medium">النوع</th>
                <th className="px-5 py-3 text-slate-500 font-medium">الهدف</th>
                <th className="px-5 py-3 text-slate-500 font-medium">السبب / التفاصيل</th>
                <th className="px-5 py-3 text-slate-500 font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-600">لا توجد سجلات</td>
                </tr>
              )}
              {logs.map((log: any) => {
                const meta = ACTION_META[log.action] ?? { label: log.action, variant: 'muted' as const };
                const icon = TARGET_ICON[log.target_type] ?? '•';
                const extra = log.metadata && Object.keys(log.metadata).length > 0
                  ? Object.entries(log.metadata)
                      .filter(([k]) => k !== 'soft_delete')
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' · ')
                  : null;
                return (
                  <tr key={log.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/20 transition-colors text-right">
                    <td className="px-5 py-3">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-sm">
                      {icon} {log.target_type}
                    </td>
                    <td className="px-5 py-3 text-slate-300 max-w-[200px]">
                      <p className="truncate">{log.target_label ?? '—'}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs max-w-[260px]">
                      {log.reason && <p className="text-slate-400">{log.reason}</p>}
                      {extra   && <p className="text-slate-600 mt-0.5">{extra}</p>}
                      {!log.reason && !extra && <span className="text-slate-700">—</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDate(log.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-800 px-5 py-3 flex items-center justify-between">
            <span className="text-slate-500 text-xs">
              صفحة {page + 1} من {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 0 && (
                <a
                  href={`/audit?${new URLSearchParams({ ...(action ? { action } : {}), ...(target ? { target } : {}), page: String(page - 1) })}`}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors"
                >
                  السابق
                </a>
              )}
              {page < totalPages - 1 && (
                <a
                  href={`/audit?${new URLSearchParams({ ...(action ? { action } : {}), ...(target ? { target } : {}), page: String(page + 1) })}`}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors"
                >
                  التالي
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
