import { supabaseAdmin } from '../lib/supabase';
import { NotificationForm } from './notification-form';

export const dynamic = 'force-dynamic';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-JO', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

async function getRecentBroadcasts() {
  const { data } = await supabaseAdmin
    .from('admin_audit_log')
    .select('id, target_label, metadata, created_at')
    .eq('action', 'broadcast_notification')
    .order('created_at', { ascending: false })
    .limit(20);
  return data ?? [];
}

async function getNotificationStats() {
  const { count: total } = await supabaseAdmin
    .from('notifications')
    .select('id', { count: 'exact', head: true });

  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count: last24h } = await supabaseAdmin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since24h);

  return { total: total ?? 0, last24h: last24h ?? 0 };
}

export default async function NotificationsPage() {
  const [broadcasts, stats] = await Promise.all([
    getRecentBroadcasts(),
    getNotificationStats(),
  ]);

  const SEGMENT_LABEL: Record<string, string> = {
    all:                  'الجميع',
    clients:              'العملاء',
    providers:            'المزودون',
    subscribed_providers: 'المشتركون',
  };

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">الإشعارات</h1>
          <p className="text-slate-500 text-sm mt-0.5">إرسال إشعارات للمستخدمين</p>
        </div>
        <div className="flex gap-3">
          {[
            { label: 'إجمالي الإشعارات', value: stats.total,  cls: 'text-slate-300' },
            { label: 'آخر 24 ساعة',      value: stats.last24h, cls: 'text-amber-400' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-right">
              <div className={`text-lg font-bold ${cls}`}>{value}</div>
              <div className="text-xs text-slate-600">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Send form */}
        <NotificationForm />

        {/* Broadcast history */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-slate-200 font-semibold mb-4">سجل البث</h2>
          {broadcasts.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-8">لم يُرسَل أي بث بعد</p>
          ) : (
            <div className="space-y-3">
              {broadcasts.map((b: any) => {
                const meta    = b.metadata ?? {};
                const segment = SEGMENT_LABEL[meta.segment] ?? meta.segment ?? '—';
                const sent    = meta.sent ?? '?';
                const city    = meta.city ? ` · ${meta.city}` : '';
                return (
                  <div key={b.id} className="border border-slate-800 rounded-xl p-3 text-right">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-slate-500 text-xs shrink-0">{fmtDate(b.created_at)}</span>
                      <p className="text-slate-200 text-sm font-medium leading-tight">{b.target_label}</p>
                    </div>
                    <div className="mt-1.5 flex gap-2 justify-end flex-wrap">
                      <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg px-2 py-0.5">
                        {sent} مستخدم
                      </span>
                      <span className="text-xs bg-slate-800 text-slate-400 rounded-lg px-2 py-0.5">
                        {segment}{city}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
