import { supabaseAdmin } from '../lib/supabase';
import { AlertReadAction } from './alert-read-action';

export const dynamic = 'force-dynamic';

async function getAlerts() {
  // Get cancellation abuse alerts
  const { data: alerts } = await supabaseAdmin
    .from('admin_alerts')
    .select(`
      id, alert_type, message, metadata, is_read, created_at,
      user:users(id, full_name, phone, role)
    `)
    .eq('alert_type', 'cancellation_abuse')
    .order('created_at', { ascending: false })
    .limit(100);

  // Get recent cancellation log with job/user details
  const { data: logs } = await supabaseAdmin
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
    `)
    .order('created_at', { ascending: false })
    .limit(50);

  return { alerts: alerts ?? [], logs: logs ?? [] };
}

export default async function CancellationsPage() {
  const { alerts, logs } = await getAlerts();

  const unreadCount = alerts.filter(a => !a.is_read).length;

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

      {/* Unread alerts */}
      {alerts.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-slate-500">لا توجد تنبيهات إلغاء حتى الآن</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/30">
            <h2 className="text-slate-300 font-semibold text-sm">التنبيهات ({alerts.length})</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {alerts.map(alert => {
              const meta = (alert.metadata as any) ?? {};
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
                  {!alert.is_read && (
                    <AlertReadAction alertId={alert.id} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent cancellation log */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/30">
          <h2 className="text-slate-300 font-semibold text-sm">آخر الإلغاءات ({logs.length})</h2>
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-slate-600 text-sm">لا توجد إلغاءات مسجّلة</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {logs.map(log => {
              const cancelledUser = (log.cancelled_by_user as any);
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
                        {log.cancelled_party === 'client' ? 'عميل' : 'مزود'}
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
        )}
      </div>
    </div>
  );
}
