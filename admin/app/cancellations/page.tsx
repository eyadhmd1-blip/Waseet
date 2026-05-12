import { supabaseAdmin } from '../lib/supabase';
import { AlertReadAction } from './alert-read-action';

export const dynamic = 'force-dynamic';

const LOG_PAGE_SIZE   = 50;
const ALERT_PAGE_SIZE = 50;

async function getData(alertPage: number, logPage: number) {
  const [alertsRes, logsRes, unreadRes] = await Promise.all([
    supabaseAdmin
      .from('admin_alerts')
      .select(`
        id, alert_type, message, metadata, is_read, created_at,
        user:users(id, full_name, phone, role)
      `, { count: 'exact' })
      .eq('alert_type', 'cancellation_abuse')
      .order('created_at', { ascending: false })
      .range(alertPage * ALERT_PAGE_SIZE, (alertPage + 1) * ALERT_PAGE_SIZE - 1),

    supabaseAdmin
      .from('cancellation_log')
      .select(`
        id, cancelled_party, reason, created_at,
        cancelled_by_user:users!cancellation_log_cancelled_by_fkey(full_name, phone, role),
        job:jobs(
          id, status,
          request:requests(title, category_slug),
          client:users!jobs_client_id_fkey(full_name),
          provider:providers!jobs_provider_id_fkey(user:users(full_name))
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(logPage * LOG_PAGE_SIZE, (logPage + 1) * LOG_PAGE_SIZE - 1),

    // DB count for unread badge — not bounded by page size
    supabaseAdmin
      .from('admin_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('alert_type', 'cancellation_abuse')
      .eq('is_read', false),
  ]);

  return {
    alerts:      alertsRes.data  ?? [],
    alertsTotal: alertsRes.count ?? 0,
    logs:        logsRes.data    ?? [],
    logsTotal:   logsRes.count   ?? 0,
    unreadCount: unreadRes.count ?? 0,
  };
}

export default async function CancellationsPage({
  searchParams,
}: {
  searchParams: Promise<{ ap?: string; lp?: string }>;
}) {
  const sp        = await searchParams;
  const alertPage = Math.max(0, parseInt(sp.ap ?? '0', 10));
  const logPage   = Math.max(0, parseInt(sp.lp ?? '0', 10));

  const { alerts, alertsTotal, logs, logsTotal, unreadCount } = await getData(alertPage, logPage);

  const alertTotalPages = Math.ceil(alertsTotal / ALERT_PAGE_SIZE);
  const logTotalPages   = Math.ceil(logsTotal   / LOG_PAGE_SIZE);

  const alertPageUrl = (p: number) => {
    const params = new URLSearchParams({ ...(sp.lp ? { lp: sp.lp } : {}), ap: String(p) });
    if (params.get('ap') === '0') params.delete('ap');
    return `/cancellations?${params}`;
  };

  const logPageUrl = (p: number) => {
    const params = new URLSearchParams({ ...(sp.ap ? { ap: sp.ap } : {}), lp: String(p) });
    if (params.get('lp') === '0') params.delete('lp');
    return `/cancellations?${params}`;
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {unreadCount} جديد
            </span>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-100">تنبيهات الإلغاءات</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              مستخدمون وصلوا لحد 3 إلغاءات في الشهر
            </p>
          </div>
        </div>
      </div>

      {/* Alerts section */}
      {alertsTotal === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-slate-500">لا توجد تنبيهات إلغاء حتى الآن</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/30">
            <h2 className="text-slate-300 font-semibold text-sm">التنبيهات ({alertsTotal})</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {alerts.map((alert: any) => {
              const meta = alert.metadata ?? {};
              const user = alert.user as any;
              return (
                <div
                  key={alert.id}
                  className={`p-4 flex items-start gap-4 flex-row-reverse ${!alert.is_read ? 'bg-amber-500/5' : ''}`}
                >
                  <div className="flex-1 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      {!alert.is_read && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                      )}
                      <span className="text-slate-200 font-medium text-sm">{user?.full_name ?? '—'}</span>
                      <span className="text-slate-500 text-xs">{user?.phone ?? ''}</span>
                    </div>
                    <p className="text-slate-400 text-sm mt-1">{alert.message}</p>
                    <div className="flex items-center gap-3 mt-1 justify-end">
                      <span className="text-slate-600 text-xs">
                        {meta.count ?? '?'} إلغاءات في {meta.month ?? '—'}
                      </span>
                      <span className="text-slate-600 text-xs">
                        {new Date(alert.created_at).toLocaleDateString('ar-JO', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                  {!alert.is_read && <AlertReadAction alertId={alert.id} />}
                </div>
              );
            })}
          </div>

          {/* Alerts pagination */}
          {alertTotalPages > 1 && (
            <div className="border-t border-slate-800 px-5 py-3 flex items-center justify-between">
              <span className="text-slate-500 text-xs">صفحة {alertPage + 1} من {alertTotalPages} · {alertsTotal} تنبيه</span>
              <div className="flex gap-2">
                {alertPage > 0 && (
                  <a href={alertPageUrl(alertPage - 1)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors">السابق</a>
                )}
                {alertPage < alertTotalPages - 1 && (
                  <a href={alertPageUrl(alertPage + 1)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors">التالي</a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cancellation log section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/30">
          <h2 className="text-slate-300 font-semibold text-sm">سجل الإلغاءات ({logsTotal})</h2>
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-slate-600 text-sm">لا توجد إلغاءات مسجّلة</div>
        ) : (
          <>
            <div className="divide-y divide-slate-800">
              {logs.map((log: any) => {
                const cancelledUser = log.cancelled_by_user as any;
                const job = log.job as any;
                return (
                  <div key={log.id} className="px-5 py-4 text-right">
                    <div className="flex items-start justify-between flex-row-reverse">
                      <div>
                        <span className="text-slate-200 text-sm font-medium">
                          {cancelledUser?.full_name ?? '—'}
                        </span>
                        <span className={`mr-2 text-xs px-2 py-0.5 rounded-full ${
                          log.cancelled_party === 'client'
                            ? 'bg-sky-500/15 text-sky-400'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}>
                          {log.cancelled_party === 'client' ? 'عميل' : 'مقدم'}
                        </span>
                      </div>
                      <span className="text-slate-600 text-xs">
                        {new Date(log.created_at).toLocaleDateString('ar-JO', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </div>
                    {job?.request?.title && (
                      <div className="text-slate-500 text-xs mt-1">{job.request.title}</div>
                    )}
                    {log.reason && (
                      <div className="text-slate-400 text-xs mt-1">السبب: {log.reason}</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Logs pagination */}
            {logTotalPages > 1 && (
              <div className="border-t border-slate-800 px-5 py-3 flex items-center justify-between">
                <span className="text-slate-500 text-xs">صفحة {logPage + 1} من {logTotalPages} · {logsTotal} إلغاء</span>
                <div className="flex gap-2">
                  {logPage > 0 && (
                    <a href={logPageUrl(logPage - 1)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors">السابق</a>
                  )}
                  {logPage < logTotalPages - 1 && (
                    <a href={logPageUrl(logPage + 1)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors">التالي</a>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
