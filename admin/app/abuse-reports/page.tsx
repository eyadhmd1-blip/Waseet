import { supabaseAdmin } from '../lib/supabase';
import { ReportActions } from './report-actions';

async function getReports() {
  const { data } = await supabaseAdmin
    .from('reports')
    .select(`
      id, report_type, description, status, created_at, admin_notes,
      reporter:users!reports_reporter_id_fkey(full_name, phone, role),
      reported:users!reports_reported_user_id_fkey(full_name, phone, role),
      request:requests(title, category_slug)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

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

export default async function AbuseReportsPage() {
  const reports = await getReports();

  const pending   = reports.filter(r => r.status === 'pending').length;
  const reviewed  = reports.filter(r => r.status === 'reviewed').length;
  const resolved  = reports.filter(r => r.status === 'resolved').length;

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
          { label: 'بلاغات معلّقة',   value: pending,  color: 'text-amber-400' },
          { label: 'قيد المعالجة',    value: reviewed, color: 'text-sky-400' },
          { label: 'محلولة',           value: resolved, color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-right">
            <div className={`text-3xl font-bold ${color}`}>{value}</div>
            <div className="text-slate-400 text-sm mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Reports table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {reports.length === 0 ? (
          <div className="p-12 text-center text-slate-600">لا توجد بلاغات بعد</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {reports.map(report => (
              <div key={report.id} className="p-5 space-y-3">
                {/* Top row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_COLOR[report.status] ?? STATUS_COLOR.pending}`}>
                      {STATUS_LABEL[report.status] ?? report.status}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                      {TYPE_LABEL[report.report_type] ?? report.report_type}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-200 font-semibold text-sm">
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
                {report.status === 'pending' || report.status === 'reviewed' ? (
                  <ReportActions reportId={report.id} currentStatus={report.status} />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
