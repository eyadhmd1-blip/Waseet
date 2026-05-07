import { supabaseAdmin } from '../lib/supabase';
import { Badge } from '../ui/badge';
import { UserActions } from './user-actions';
import { FilterBar } from '../ui/filter-bar';
import type { FilterConfig } from '../ui/filter-bar';

export const dynamic = 'force-dynamic';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-JO', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const ROLE_META: Record<string, { label: string; variant: 'info' | 'violet' | 'danger' }> = {
  client:   { label: 'عميل',  variant: 'info' },
  provider: { label: 'مزود',  variant: 'violet' },
  admin:    { label: 'مدير',  variant: 'danger' },
};

const FILTERS: FilterConfig[] = [
  {
    key: 'role',
    label: 'الدور',
    options: [
      { value: 'client',   label: 'عميل' },
      { value: 'provider', label: 'مزود' },
      { value: 'admin',    label: 'مدير' },
    ],
  },
  {
    key: 'status',
    label: 'الحالة',
    options: [
      { value: 'active',   label: 'نشط' },
      { value: 'disabled', label: 'موقوف' },
    ],
  },
  {
    key: 'verified',
    label: 'التحقق',
    options: [
      { value: 'yes', label: 'موثّق' },
      { value: 'no',  label: 'غير موثّق' },
    ],
  },
];

const PAGE_SIZE = 50;

async function getUsers(params: { q?: string; role?: string; status?: string; verified?: string; page: number }) {
  let query = supabaseAdmin
    .from('users')
    .select('id, full_name, phone, role, city, phone_verified, created_at, is_disabled, disabled_reason', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(params.page * PAGE_SIZE, (params.page + 1) * PAGE_SIZE - 1);

  if (params.q) {
    query = query.or(`full_name.ilike.%${params.q}%,phone.ilike.%${params.q}%`);
  }
  if (params.role) {
    query = query.eq('role', params.role);
  }
  if (params.status === 'active')   query = query.eq('is_disabled', false);
  if (params.status === 'disabled') query = query.eq('is_disabled', true);
  if (params.verified === 'yes')    query = query.eq('phone_verified', true);
  if (params.verified === 'no')     query = query.eq('phone_verified', false);

  const { data, count } = await query;
  return { users: data ?? [], total: count ?? 0 };
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string; verified?: string; page?: string }>;
}) {
  const sp   = await searchParams;
  const page = Math.max(0, parseInt(sp.page ?? '0', 10));
  const { users, total } = await getUsers({ ...sp, page });

  const clients   = users.filter((u: any) => u.role === 'client').length;
  const providers = users.filter((u: any) => u.role === 'provider').length;
  const disabled  = users.filter((u: any) => u.is_disabled).length;
  const verified  = users.filter((u: any) => u.phone_verified).length;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const current: Record<string, string> = {
    q:        sp.q        ?? '',
    role:     sp.role     ?? '',
    status:   sp.status   ?? '',
    verified: sp.verified ?? '',
  };

  const pageUrl = (p: number) => {
    const params = new URLSearchParams({ ...current, page: String(p) });
    return `/users?${params}`;
  };

  return (
    <div className="p-6 space-y-6">

      {/* Header + summary pills */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">إدارة المستخدمين</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} مستخدم مسجّل</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'عملاء',    value: clients,   cls: 'text-sky-400' },
            { label: 'مزودون',   value: providers,  cls: 'text-violet-400' },
            { label: 'موثّق',    value: verified,   cls: 'text-emerald-400' },
            { label: 'موقوف',    value: disabled,   cls: 'text-red-400' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-right">
              <div className={`text-lg font-bold ${cls}`}>{value}</div>
              <div className="text-xs text-slate-600">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Search & filter bar */}
      <FilterBar current={current} searchPlaceholder="بحث بالاسم أو الهاتف..." filters={FILTERS} />

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-right bg-slate-900/80">
              <th className="px-5 py-3 text-slate-500 font-medium">المستخدم</th>
              <th className="px-5 py-3 text-slate-500 font-medium">الهاتف</th>
              <th className="px-5 py-3 text-slate-500 font-medium">الدور</th>
              <th className="px-5 py-3 text-slate-500 font-medium">المدينة</th>
              <th className="px-5 py-3 text-slate-500 font-medium">التحقق</th>
              <th className="px-5 py-3 text-slate-500 font-medium">الحالة</th>
              <th className="px-5 py-3 text-slate-500 font-medium">تاريخ التسجيل</th>
              <th className="px-5 py-3 text-slate-500 font-medium">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-600">لا توجد نتائج</td>
              </tr>
            )}
            {users.map((u: any) => {
              const role = ROLE_META[u.role] ?? ROLE_META.client;
              return (
                <tr
                  key={u.id}
                  className={`border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors text-right
                    ${u.is_disabled ? 'opacity-60' : ''}`}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3 flex-row-reverse">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0
                        ${u.is_disabled ? 'bg-slate-700 text-slate-500' : 'bg-amber-400 text-slate-900'}`}>
                        {u.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-slate-200 font-medium">{u.full_name}</p>
                        {u.is_disabled && u.disabled_reason && (
                          <p className="text-xs text-red-400/70 mt-0.5 truncate max-w-[160px]" title={u.disabled_reason}>
                            {u.disabled_reason}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-400 font-mono text-xs">{u.phone}</td>
                  <td className="px-5 py-3"><Badge variant={role.variant}>{role.label}</Badge></td>
                  <td className="px-5 py-3 text-slate-400">{u.city}</td>
                  <td className="px-5 py-3">
                    {u.phone_verified
                      ? <span className="text-emerald-400 text-xs font-semibold">✓ موثّق</span>
                      : <span className="text-slate-600 text-xs">—</span>
                    }
                  </td>
                  <td className="px-5 py-3">
                    {u.is_disabled
                      ? <Badge variant="danger">موقوف</Badge>
                      : <Badge variant="success">نشط</Badge>
                    }
                  </td>
                  <td className="px-5 py-3 text-slate-500 text-xs">{fmtDate(u.created_at)}</td>
                  <td className="px-5 py-3">
                    {u.role === 'admin' ? (
                      <span className="text-xs text-slate-600 italic">مدير النظام</span>
                    ) : (
                      <UserActions
                        userId={u.id}
                        userName={u.full_name}
                        isDisabled={u.is_disabled}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-800 px-5 py-3 flex items-center justify-between">
            <span className="text-slate-500 text-xs">صفحة {page + 1} من {totalPages}</span>
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
      </div>
    </div>
  );
}
