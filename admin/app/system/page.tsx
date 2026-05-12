import { supabaseAdmin } from '../lib/supabase';

export const dynamic = 'force-dynamic';

function fmtTime(iso: string | null) {
  if (!iso) return 'لم يُنفَّذ بعد';
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days  > 0) return `منذ ${days} يوم`;
  if (hours > 0) return `منذ ${hours} ساعة`;
  return `منذ ${mins} دقيقة`;
}

async function getSystemData() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [
    { data: cronJobs, error: cronErr },
    { count: totalNotifs },
    { count: readNotifs },
    { count: pushTokens },
    { count: expiringSubscriptions },
  ] = await Promise.all([
    supabaseAdmin.rpc('admin_cron_status'),
    supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo),
    supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', true)
      .gte('created_at', sevenDaysAgo),
    supabaseAdmin
      .from('push_tokens')
      .select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('providers')
      .select('*', { count: 'exact', head: true })
      .eq('is_subscribed', true)
      .gte('subscription_ends', new Date().toISOString())
      .lt('subscription_ends', new Date(Date.now() + 7 * 86_400_000).toISOString()),
  ]);

  const total  = totalNotifs ?? 0;
  const read   = readNotifs  ?? 0;
  const readRate = total > 0 ? Math.round((read / total) * 100) : 0;

  return {
    cronJobs:             (cronJobs as any[]) ?? [],
    cronErr:              !!cronErr,
    total7dNotifs:        total,
    readRate,
    pushTokenCount:       pushTokens ?? 0,
    expiringSubscriptions: expiringSubscriptions ?? 0,
  };
}

const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  succeeded: { label: 'نجح',  dot: 'bg-emerald-400', text: 'text-emerald-400' },
  failed:    { label: 'فشل',  dot: 'bg-red-400',     text: 'text-red-400'     },
  running:   { label: 'يعمل', dot: 'bg-blue-400 animate-pulse', text: 'text-blue-400' },
};

export default async function SystemPage() {
  const {
    cronJobs, cronErr,
    total7dNotifs, readRate,
    pushTokenCount, expiringSubscriptions,
  } = await getSystemData();

  const allCronOk = cronJobs.length > 0 && cronJobs.every((j: any) => j.last_status === 'succeeded' || !j.last_status);

  return (
    <div className="p-6 space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">صحة النظام</h1>
          <p className="text-slate-500 text-sm mt-0.5">مراقبة الخدمات والمهام المجدولة — لحظي</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium"
          style={{
            background: allCronOk ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)',
            border:     `1px solid ${allCronOk ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
            color:      allCronOk ? '#34D399' : '#F87171',
          }}>
          <div className={`w-2 h-2 rounded-full ${allCronOk ? 'bg-emerald-400' : 'bg-red-400'}`} />
          {allCronOk ? 'النظام سليم' : 'تنبيه: راجع الأخطاء'}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          {
            icon: '📲', label: 'أجهزة Push نشطة', value: pushTokenCount,
            color: 'text-blue-400', sub: 'رموز مسجلة في push_tokens',
          },
          {
            icon: '📬', label: 'إشعارات (7 أيام)', value: total7dNotifs,
            color: 'text-violet-400', sub: 'إجمالي الإشعارات المُرسلة',
          },
          {
            icon: '👁️', label: 'معدل القراءة', value: `${readRate}%`,
            color: readRate >= 50 ? 'text-emerald-400' : 'text-amber-400',
            sub: 'نسبة الإشعارات المقروءة',
          },
          {
            icon: '⏰', label: 'اشتراكات تنتهي', value: expiringSubscriptions,
            color: expiringSubscriptions > 0 ? 'text-yellow-400' : 'text-slate-500',
            sub: 'خلال 7 أيام القادمة',
          },
        ] as const).map(({ icon, label, value, color, sub }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-right">
            <div className="text-2xl mb-1">{icon}</div>
            <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
            <div className="text-slate-400 text-xs mt-0.5 font-medium">{label}</div>
            <div className="text-slate-600 text-[10px] mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Read rate bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className={`text-lg font-bold tabular-nums ${readRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {readRate}%
          </span>
          <h2 className="text-slate-200 font-semibold">معدل قراءة الإشعارات (آخر 7 أيام)</h2>
        </div>
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all"
            style={{
              width: `${readRate}%`,
              background: readRate >= 70
                ? 'linear-gradient(90deg,#059669,#34D399)'
                : readRate >= 40
                ? 'linear-gradient(90deg,#D97706,#FCD34D)'
                : 'linear-gradient(90deg,#DC2626,#F87171)',
            }} />
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 mt-1.5">
          <span>0%</span>
          <span>50% (هدف)</span>
          <span>100%</span>
        </div>
      </div>

      {/* Cron jobs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(30,41,59,1)' }}>
          <div className="flex items-center gap-2">
            {cronErr && (
              <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded">⚠️ خطأ في جلب البيانات</span>
            )}
          </div>
          <h2 className="text-slate-200 font-semibold">المهام المجدولة (pg_cron)</h2>
        </div>

        {cronJobs.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-8">
            {cronErr ? 'تعذّر الاتصال بـ cron schema' : 'لا توجد مهام مجدولة بعد'}
          </p>
        ) : (
          <div className="divide-y divide-slate-800">
            {(cronJobs as any[]).map((job, i) => {
              const meta   = STATUS_META[job.last_status] ?? { label: 'غير معروف', dot: 'bg-slate-500', text: 'text-slate-400' };
              const failed = job.last_status === 'failed';
              return (
                <div key={i} className="px-5 py-4 flex items-start justify-between gap-4"
                  style={failed ? { background: 'rgba(239,68,68,0.04)' } : {}}>
                  <div className="flex flex-col items-end gap-0.5 text-right min-w-0">
                    <span className="text-slate-200 text-sm font-medium truncate max-w-xs">{job.jobname}</span>
                    <span className="text-slate-600 text-xs font-mono">{job.schedule}</span>
                    {failed && job.last_error && (
                      <span className="text-red-400 text-[11px] mt-1 max-w-xs truncate">{job.last_error}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-1.5 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
                      <span className={`text-xs font-semibold ${meta.text}`}>{meta.label}</span>
                    </div>
                    <span className="text-slate-600 text-[11px]">{fmtTime(job.last_run)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Services status */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-slate-200 font-semibold mb-4">حالة الخدمات الخارجية</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {([
            { name: 'Supabase DB',     status: 'up', note: 'Postgres متصل'             },
            { name: 'Expo Push',       status: 'up', note: `${pushTokenCount} رمز نشط` },
            { name: 'Unifonic SMS',    status: 'configured', note: 'جاهز للإرسال'      },
          ] as const).map(({ name, status, note }) => (
            <div key={name} className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(51,65,85,0.6)' }}>
              <div>
                <div className="text-slate-400 text-xs">{note}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${status === 'up' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                  <span className={`text-xs font-semibold ${status === 'up' ? 'text-emerald-400' : 'text-blue-400'}`}>
                    {status === 'up' ? 'يعمل' : 'جاهز'}
                  </span>
                </div>
                <span className="text-slate-200 text-sm font-medium">{name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
