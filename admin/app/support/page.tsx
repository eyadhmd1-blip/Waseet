import { supabaseAdmin } from '../lib/supabase';
import { Badge } from '../ui/badge';
import Link from 'next/link';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-JO', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const CAT_META: Record<string, { label: string; icon: string }> = {
  payment:  { label: 'مدفوعات',   icon: '💳' },
  order:    { label: 'طلبات',     icon: '📋' },
  provider: { label: 'مزود خدمة', icon: '🔧' },
  account:  { label: 'حساب',      icon: '👤' },
  contract: { label: 'عقد دوري',  icon: '📄' },
  other:    { label: 'أخرى',      icon: '💬' },
};

const STATUS_META: Record<string, { label: string; variant: 'info' | 'warning' | 'success' | 'muted' }> = {
  open:      { label: 'مفتوحة',        variant: 'info' },
  in_review: { label: 'قيد المراجعة',  variant: 'warning' },
  resolved:  { label: 'محلولة',        variant: 'success' },
  closed:    { label: 'مغلقة',         variant: 'muted' },
};

async function getTickets(params: { status?: string; category?: string; priority?: string }) {
  let q = supabaseAdmin
    .from('support_tickets')
    .select('id, category, priority, status, subject, rating, opened_at, resolved_at, user_id')
    .order('priority', { ascending: false })
    .order('opened_at', { ascending: true });

  if (params.status)   q = q.eq('status',   params.status);
  if (params.category) q = q.eq('category', params.category);
  if (params.priority) q = q.eq('priority', params.priority);

  const { data: tickets, error: ticketsError } = await q.limit(100);

  if (ticketsError) {
    console.error('[support] getTickets error:', ticketsError.message, ticketsError.details);
    return [];
  }
  if (!tickets || tickets.length === 0) return [];

  // Separately fetch user info to avoid schema-cache FK join failures
  const userIds = [...new Set(tickets.map((t: any) => t.user_id).filter(Boolean))];
  const { data: users, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id, full_name, role')
    .in('id', userIds);

  if (usersError) {
    console.error('[support] getTickets users error:', usersError.message);
  }

  const userMap = Object.fromEntries((users ?? []).map((u: any) => [u.id, u]));

  return tickets.map((t: any) => ({ ...t, user: userMap[t.user_id] ?? null }));
}

async function getStats() {
  const results = await Promise.all([
    supabaseAdmin.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabaseAdmin.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'in_review'),
    supabaseAdmin.from('support_tickets').select('id', { count: 'exact', head: true }).eq('priority', 'urgent').neq('status', 'resolved').neq('status', 'closed'),
    supabaseAdmin.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'resolved'),
  ]);

  results.forEach(({ error }, i) => {
    if (error) console.error(`[support] getStats[${i}] error:`, error.message);
  });

  const [{ count: open }, { count: inReview }, { count: urgent }, { count: resolved }] = results;
  return { open: open ?? 0, inReview: inReview ?? 0, urgent: urgent ?? 0, resolved: resolved ?? 0 };
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; priority?: string }>;
}) {
  const sp = await searchParams;
  const [tickets, stats] = await Promise.all([getTickets(sp), getStats()]);

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">الدعم الفني</h1>
          <p className="text-slate-500 text-sm mt-0.5">إدارة تذاكر الدعم</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'مفتوحة',       value: stats.open,     cls: 'text-sky-400' },
            { label: 'قيد المراجعة', value: stats.inReview, cls: 'text-amber-400' },
            { label: '🔴 طارئة',     value: stats.urgent,   cls: 'text-red-400' },
            { label: 'محلولة',       value: stats.resolved, cls: 'text-emerald-400' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-right">
              <div className={`text-lg font-bold ${cls}`}>{value}</div>
              <div className="text-xs text-slate-600">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <form method="get" className="flex gap-3 flex-wrap">
        <select name="status" defaultValue={sp.status ?? ''} onChange={(e) => e.currentTarget.form?.submit()}
          className="bg-slate-900 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400/50">
          <option value="">كل الحالات</option>
          <option value="open">مفتوحة</option>
          <option value="in_review">قيد المراجعة</option>
          <option value="resolved">محلولة</option>
          <option value="closed">مغلقة</option>
        </select>
        <select name="category" defaultValue={sp.category ?? ''}
          className="bg-slate-900 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400/50">
          <option value="">كل الفئات</option>
          {Object.entries(CAT_META).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        <select name="priority" defaultValue={sp.priority ?? ''}
          className="bg-slate-900 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400/50">
          <option value="">كل الأولويات</option>
          <option value="urgent">🔴 طارئ</option>
          <option value="normal">🔵 عادي</option>
        </select>
        <button type="submit" className="px-4 py-2 rounded-xl bg-amber-500 text-slate-900 text-sm font-bold">تصفية</button>
        {(sp.status || sp.category || sp.priority) && (
          <a href="/support" className="px-4 py-2 rounded-xl bg-slate-800 text-slate-400 text-sm hover:bg-slate-700 transition-colors">مسح</a>
        )}
      </form>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[850px]">
            <thead>
              <tr className="border-b border-slate-800 text-right bg-slate-900/80">
                <th className="px-5 py-3 text-slate-500 font-medium">رقم التذكرة</th>
                <th className="px-5 py-3 text-slate-500 font-medium">المستخدم</th>
                <th className="px-5 py-3 text-slate-500 font-medium">الموضوع</th>
                <th className="px-5 py-3 text-slate-500 font-medium">الفئة</th>
                <th className="px-5 py-3 text-slate-500 font-medium">الأولوية</th>
                <th className="px-5 py-3 text-slate-500 font-medium">الحالة</th>
                <th className="px-5 py-3 text-slate-500 font-medium">التقييم</th>
                <th className="px-5 py-3 text-slate-500 font-medium">التاريخ</th>
                <th className="px-5 py-3 text-slate-500 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-600">لا توجد تذاكر</td>
                </tr>
              )}
              {tickets.map((t: any) => {
                const cat    = CAT_META[t.category] ?? CAT_META.other;
                const st     = STATUS_META[t.status] ?? STATUS_META.open;
                const urgent = t.priority === 'urgent';
                const rowCls = urgent && t.status !== 'resolved' ? 'bg-red-950/20' : '';

                return (
                  <tr key={t.id} className={`border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors text-right ${rowCls}`}>
                    <td className="px-5 py-3 text-amber-400 font-bold text-xs">
                      {t.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-slate-200 font-medium text-sm">{t.user?.full_name ?? '—'}</div>
                      <div className="text-slate-500 text-xs">{t.user?.role === 'provider' ? 'مزود' : 'عميل'}</div>
                    </td>
                    <td className="px-5 py-3 max-w-[200px]">
                      <p className="text-slate-200 font-medium truncate">{t.subject}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {cat.icon} {cat.label}
                    </td>
                    <td className="px-5 py-3">
                      {urgent
                        ? <Badge variant="danger">🔴 طارئ</Badge>
                        : <Badge variant="muted">🔵 عادي</Badge>
                      }
                    </td>
                    <td className="px-5 py-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                    <td className="px-5 py-3 text-xs">
                      {t.rating
                        ? <span className="text-amber-400">{'⭐'.repeat(t.rating)}</span>
                        : <span className="text-slate-700">—</span>
                      }
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {fmtDate(t.opened_at)}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/support/${t.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-amber-500 hover:text-slate-900 transition-colors font-semibold"
                      >
                        فتح
                      </Link>
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
