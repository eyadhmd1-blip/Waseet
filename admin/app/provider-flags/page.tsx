import { supabaseAdmin } from '../lib/supabase';
import { FlagActions } from './flag-actions';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

const REASON_LABEL: Record<string, string> = {
  low_rating:      'تقييم منخفض',
  high_rejection:  'رفض مرتفع',
  complaints:      'شكاوى متعددة',
  job_abandonment: 'تخلٍّ عن وظيفة',
};

const REASON_COLOR: Record<string, string> = {
  low_rating:      'bg-amber-500/15 text-amber-400 border-amber-500/30',
  high_rejection:  'bg-orange-500/15 text-orange-400 border-orange-500/30',
  complaints:      'bg-rose-500/15 text-rose-400 border-rose-500/30',
  job_abandonment: 'bg-slate-700/60 text-slate-400 border-slate-600',
};

const ACTION_COLOR: Record<string, string> = {
  warned:    'bg-amber-500/15 text-amber-400 border-amber-500/30',
  suspended: 'bg-red-500/15 text-red-400 border-red-500/30',
  cleared:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

const ACTION_LABEL: Record<string, string> = {
  warned:    'تحذير',
  suspended: 'إيقاف',
  cleared:   'تبرئة',
};

const FILTER_OPTIONS = [
  { value: '',      label: 'قيد المراجعة' },
  { value: 'all',   label: 'الكل' },
];

async function getFlags(page: number, showAll: boolean) {
  let q = supabaseAdmin
    .from('provider_flags')
    .select(`
      id, reason, details, reviewed, reviewed_at, reviewed_by, action_taken, admin_note, created_at,
      provider:providers!provider_flags_provider_id_fkey(
        id, display_name, phone, reputation_tier, is_active, flag_count,
        user:users!providers_id_fkey(full_name, phone)
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (!showAll) q = q.eq('reviewed', false);

  const { data, count, error } = await q;

  if (error) {
    console.error('[provider-flags] getFlags failed:', error.message);
    return { flags: [], total: 0, fetchError: error.message };
  }
  return { flags: data ?? [], total: count ?? 0, fetchError: null };
}

async function getStats() {
  const [unreviewed, warned, suspended, cleared] = await Promise.all([
    supabaseAdmin.from('provider_flags').select('id', { count: 'exact', head: true }).eq('reviewed', false),
    supabaseAdmin.from('provider_flags').select('id', { count: 'exact', head: true }).eq('action_taken', 'warned'),
    supabaseAdmin.from('provider_flags').select('id', { count: 'exact', head: true }).eq('action_taken', 'suspended'),
    supabaseAdmin.from('provider_flags').select('id', { count: 'exact', head: true }).eq('action_taken', 'cleared'),
  ]);
  return {
    unreviewed: unreviewed.count ?? 0,
    warned:     warned.count     ?? 0,
    suspended:  suspended.count  ?? 0,
    cleared:    cleared.count    ?? 0,
  };
}

function formatDetails(reason: string, details: Record<string, unknown>): string {
  if (reason === 'low_rating') {
    return `متوسط التقييم: ${details.avg_rating} من ${details.rated_jobs} وظيفة`;
  }
  if (reason === 'high_rejection') {
    return `نسبة الرفض: ${details.rejection_rate_pct}% من ${details.total_decided_bids} عرض`;
  }
  if (reason === 'complaints') {
    return `${details.distinct_reporters} شكوى من عملاء مختلفين`;
  }
  if (reason === 'job_abandonment') {
    return `طلب متروك منذ أكثر من 72 ساعة`;
  }
  return JSON.stringify(details);
}

export default async function ProviderFlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const sp      = await searchParams;
  const showAll = sp.filter === 'all';
  const page    = Math.max(0, parseInt(sp.page ?? '0', 10));

  const [{ flags, total, fetchError }, stats] = await Promise.all([
    getFlags(page, showAll),
    getStats(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const pageUrl = (p: number) => {
    const params = new URLSearchParams({ ...(showAll ? { filter: 'all' } : {}), page: String(p) });
    if (params.get('page') === '0') params.delete('page');
    return `/provider-flags?${params}`;
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">مراقبة المقدمين</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {showAll ? `${total} بلاغ إجمالاً` : `${stats.unreviewed} بلاغ قيد المراجعة`}
          </p>
        </div>
      </div>

      {fetchError && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-4 text-right">
          <div className="text-red-400 font-semibold text-sm mb-1">⚠️ خطأ في جلب البيانات</div>
          <div className="text-red-300/70 text-xs font-mono">{fetchError}</div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'قيد المراجعة', value: stats.unreviewed, color: 'text-amber-400' },
          { label: 'تحذير',        value: stats.warned,     color: 'text-orange-400' },
          { label: 'إيقاف',        value: stats.suspended,  color: 'text-red-400' },
          { label: 'تبرئة',        value: stats.cleared,    color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-right">
            <div className={`text-3xl font-bold ${color}`}>{value}</div>
            <div className="text-slate-400 text-sm mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {FILTER_OPTIONS.map(opt => (
          <a
            key={opt.value}
            href={opt.value === 'all' ? '/provider-flags?filter=all' : '/provider-flags'}
            className={`text-sm px-4 py-2 rounded-lg transition-colors ${
              (showAll ? 'all' : '') === opt.value
                ? 'bg-amber-400/15 text-amber-400 border border-amber-500/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            {opt.label}
          </a>
        ))}
      </div>

      {/* Flags list */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-slate-200">سجل البلاغات</h2>
        </div>
        {flags.length === 0 ? (
          <div className="p-12 text-center text-slate-600">
            {fetchError ? 'فشل جلب البيانات' : 'لا توجد بلاغات'}
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-800">
              {flags.map((flag: any) => {
                const prov        = flag.provider as any;
                const provName    = prov?.display_name ?? (prov?.user as any)?.full_name ?? '—';
                const provPhone   = prov?.phone ?? (prov?.user as any)?.phone ?? '—';
                const details     = (flag.details ?? {}) as Record<string, unknown>;

                return (
                  <div key={flag.id} className="p-5 space-y-3">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2.5 py-1 rounded-full border ${REASON_COLOR[flag.reason] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                          {REASON_LABEL[flag.reason] ?? flag.reason}
                        </span>
                        {flag.reviewed && flag.action_taken && (
                          <span className={`text-xs px-2.5 py-1 rounded-full border ${ACTION_COLOR[flag.action_taken] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                            {ACTION_LABEL[flag.action_taken] ?? flag.action_taken}
                          </span>
                        )}
                        {!flag.reviewed && (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            قيد المراجعة
                          </span>
                        )}
                        {prov?.flag_count > 1 && (
                          <span className="text-xs px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            {prov.flag_count} بلاغات
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-slate-200 font-semibold text-sm">{provName}</div>
                        <div className="text-slate-500 text-xs mt-0.5">
                          {provPhone} · {prov?.reputation_tier ?? '—'}
                          {prov?.is_active === false && (
                            <span className="mr-1.5 text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">موقوف</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="bg-slate-800/50 rounded-lg px-3 py-2 text-right">
                      <p className="text-slate-400 text-sm">{formatDetails(flag.reason, details)}</p>
                    </div>

                    {/* Admin note if reviewed */}
                    {flag.admin_note && (
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-right">
                        <div className="text-xs text-amber-400 mb-1">ملاحظة الإدارة · {flag.reviewed_by} · {new Date(flag.reviewed_at).toLocaleDateString('ar-JO', { day: 'numeric', month: 'short' })}</div>
                        <p className="text-slate-300 text-sm">{flag.admin_note}</p>
                      </div>
                    )}

                    {/* Action row */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-slate-600 text-xs">
                        {new Date(flag.created_at).toLocaleDateString('ar-JO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {!flag.reviewed && (
                        <FlagActions
                          flagId={flag.id}
                          flagReason={flag.reason}
                          providerName={provName}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t border-slate-800 px-5 py-3 flex items-center justify-between">
                <span className="text-slate-500 text-xs">صفحة {page + 1} من {totalPages} · {total} بلاغ</span>
                <div className="flex gap-2">
                  {page > 0 && (
                    <a href={pageUrl(page - 1)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors">السابق</a>
                  )}
                  {page < totalPages - 1 && (
                    <a href={pageUrl(page + 1)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 transition-colors">التالي</a>
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
