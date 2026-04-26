import { supabaseAdmin } from '../lib/supabase';
import { ReportActions, SuspendActions } from './report-actions';

async function getReports() {
  const { data } = await supabaseAdmin
    .from('reports')
    .select(`
      id, report_type, description, status, created_at, admin_notes, context,
      reporter:users!reports_reporter_id_fkey(full_name, phone, role),
      reported:users!reports_reported_user_id_fkey(id, full_name, phone, role, is_suspended),
      request:requests(title, category_slug)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  return data ?? [];
}

async function getTopReported() {
  const { data } = await supabaseAdmin
    .from('user_report_counts')
    .select('*')
    .order('total_reports', { ascending: false })
    .limit(10);

  return data ?? [];
}

const TYPE_LABEL: Record<string, string> = {
  no_show:  'عدم الحضور',
  fake_bid: 'عرض وهمي',
  abusive:  'محتوى مسيء',
  spam:     'رسائل مزعجة',
  other:    'أخرى',
};

const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  reviewed:  'bg-sky-500/15 text-sky-400 border-sky-500/30',
  resolved:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  dismissed: 'bg-slate-700/50 text-slate-500 border-slate-700',
};

const STATUS_LABEL: Record<string, string> = {
  pending:   'قيد المراجعة',
  reviewed:  'قيد المعالجة',
  resolved:  'تم الحل',
  dismissed: 'مرفوض',
};

const CONTEXT_LABEL: Record<string, string> = {
  request: 'طلب',
  chat:    'محادثة',
  profile: 'بروفايل',
};

const CONTEXT_COLOR: Record<string, string> = {
  request: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  chat:    'bg-sky-500/15 text-sky-400 border-sky-500/30',
  profile: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

export default async function AbuseReportsPage() {
  const [reports, topReported] = await Promise.all([getReports(), getTopReported()]);

  const pending  = reports.filter(r => r.status === 'pending').length;
  const reviewed = reports.filter(r => r.status === 'reviewed').length;
  const resolved = reports.filter(r => r.status === 'resolved').length;

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">البلاغات والمخالفات</h1>
          <p className="text-slate-500 text-sm mt-0.5">بلاغات المستخدمين على السلوك المسيء</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'بلاغات معلّقة', value: pending,  color: 'text-amber-400' },
          { label: 'قيد المعالجة',  value: reviewed, color: 'text-sky-400' },
          { label: 'محلولة',         value: resolved, color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-right">
            <div className={`text-3xl font-bold ${color}`}>{value}</div>
            <div className="text-slate-400 text-sm mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Top reported users */}
      {topReported.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-base font-semibold text-slate-200">الحسابات المُبلَّغ عنها</h2>
            <p className="text-xs text-slate-500 mt-0.5">مرتبة حسب عدد البلاغات</p>
          </div>
          <div className="divide-y divide-slate-800">
            {topReported.map((u: any) => (
              <div key={u.user_id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${u.is_suspended ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  <div className="min-w-0">
                    <div className="text-slate-200 text-sm font-medium truncate">{u.full_name ?? '—'}</div>
                    <div className="text-slate-500 text-xs">{u.phone} · {u.role === 'provider' ? 'مزوّد' : 'طالب'}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-rose-400 font-bold text-lg">{u.total_reports}</div>
                    <div className="text-slate-600 text-xs">بلاغ</div>
                  </div>
                  {u.pending_reports > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      {u.pending_reports} معلّق
                    </span>
                  )}
                  <SuspendActions
                    userId={u.user_id}
                    userName={u.full_name ?? ''}
                    isSuspended={u.is_suspended}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reports list */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-slate-200">سجل البلاغات</h2>
        </div>
        {reports.length === 0 ? (
          <div className="p-12 text-center text-slate-600">لا توجد بلاغات بعد</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {reports.map(report => (
              <div key={report.id} className="p-5 space-y-3">
                {/* Top row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <span className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_COLOR[report.status] ?? STATUS_COLOR.pending}`}>
                      {STATUS_LABEL[report.status] ?? report.status}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      {TYPE_LABEL[report.report_type] ?? report.report_type}
                    </span>
                    {(report as any).context && (
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${CONTEXT_COLOR[(report as any).context] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                        من: {CONTEXT_LABEL[(report as any).context] ?? (report as any).context}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-slate-200 font-semibold text-sm flex items-center gap-2 justify-end">
                      {(report.reported as any)?.is_suspended && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">موقوف</span>
                      )}
                      بلاغ على: <span className="text-red-400">{(report.reported as any)?.full_name ?? '—'}</span>
                    </div>
                    <div className="text-slate-500 text-xs mt-0.5">
                      من: {(report.reporter as any)?.full_name ?? '—'} ·{' '}
                      {new Date(report.created_at).toLocaleDateString('ar-JO', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                {/* Request context */}
                {(report.request as any)?.title && (
                  <div className="text-xs text-slate-500 bg-slate-800/50 rounded-lg px-3 py-2 text-right">
                    الطلب: {(report.request as any).title}
                  </div>
                )}

                {/* Description */}
                {report.description && (
                  <p className="text-slate-400 text-sm text-right leading-relaxed">
                    {report.description}
                  </p>
                )}

                {/* Admin notes */}
                {report.admin_notes && (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-right">
                    <div className="text-xs text-amber-400 mb-1">ملاحظات الإدارة:</div>
                    <p className="text-slate-300 text-sm">{report.admin_notes}</p>
                  </div>
                )}

                {/* Actions */}
                {(report.status === 'pending' || report.status === 'reviewed') && (
                  <ReportActions
                    reportId={report.id}
                    currentStatus={report.status}
                    reportedUserId={(report.reported as any)?.id}
                    isSuspended={(report.reported as any)?.is_suspended ?? false}
                    reportedName={(report.reported as any)?.full_name ?? ''}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
