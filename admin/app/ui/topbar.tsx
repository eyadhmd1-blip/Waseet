'use client';

import { usePathname } from 'next/navigation';

const PAGE_META: Record<string, { label: string; icon: string }> = {
  '/':                { label: 'لوحة التحكم',          icon: '📊' },
  '/users':           { label: 'إدارة العملاء',         icon: '👤' },
  '/providers':       { label: 'إدارة المقدمين',        icon: '🔧' },
  '/requests':        { label: 'إدارة الطلبات',         icon: '📋' },
  '/contracts':       { label: 'العقود الدورية',        icon: '🔄' },
  '/reports':         { label: 'التقارير والإحصائيات',  icon: '📈' },
  '/support':         { label: 'الدعم والمدفوعات',      icon: '💳' },
  '/provider-flags':  { label: 'مراقبة المقدمين',       icon: '🚨' },
  '/abuse-reports':   { label: 'البلاغات والمخالفات',   icon: '🚩' },
  '/cancellations':   { label: 'تنبيهات الإلغاء',       icon: '⚠️' },
  '/category-limits': { label: 'حدود أسعار الخدمات',    icon: '💰' },
  '/categories':      { label: 'التصنيفات والخدمات',    icon: '🗂️' },
  '/suggestions':     { label: 'اقتراحات الخدمات',      icon: '💡' },
  '/notifications':   { label: 'الإشعارات الجماعية',    icon: '🔔' },
  '/audit':           { label: 'سجل النشاط',            icon: '🔍' },
  '/settings':        { label: 'إعدادات المنصة',        icon: '⚙️' },
};

export function TopBar() {
  const pathname = usePathname();

  // Match longest prefix
  const matchKey = Object.keys(PAGE_META)
    .filter(k => k !== '/' && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0]
    ?? (pathname === '/' ? '/' : undefined);
  const page = matchKey ? PAGE_META[matchKey] : { label: pathname, icon: '📄' };

  const today = new Date().toLocaleDateString('ar-JO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <header
      className="h-14 shrink-0 flex items-center justify-between px-6 gap-4"
      style={{
        background: 'var(--sidebar-bg)',
        borderBottom: '1px solid var(--sidebar-border)',
      }}
    >
      {/* ── Left: Search bar ───────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative hidden md:flex items-center">
          <div className="absolute right-3 text-slate-600 text-sm pointer-events-none">🔍</div>
          <input
            readOnly
            placeholder="ابحث عن طلب، مستخدم، مقدم..."
            className="w-64 h-9 rounded-xl pr-9 pl-4 text-sm text-slate-400
              placeholder:text-slate-600 outline-none cursor-default"
            style={{
              background: 'rgba(109,40,217,0.07)',
              border: '1px solid rgba(109,40,217,0.18)',
            }}
          />
          <div className="absolute left-3 flex items-center gap-0.5">
            <kbd className="text-[9px] text-slate-600 px-1 py-0.5 rounded bg-slate-800/60 border border-slate-700/50">⌘</kbd>
            <kbd className="text-[9px] text-slate-600 px-1 py-0.5 rounded bg-slate-800/60 border border-slate-700/50">K</kbd>
          </div>
        </div>
      </div>

      {/* ── Right: Page title + date + user ────────────────────── */}
      <div className="flex items-center gap-5" dir="rtl">

        {/* Page title */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
            style={{ background: 'rgba(124,58,237,0.15)' }}>
            {page.icon}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100 leading-none">{page.label}</div>
            <div className="text-[10px] text-slate-600 mt-0.5">{today}</div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-violet-900/30" />

        {/* User avatar */}
        <div className="flex items-center gap-2.5">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-slate-200 leading-none">Eyad Admin</div>
            <div className="text-[10px] text-slate-600 mt-0.5">مدير النظام</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500
            flex items-center justify-center text-slate-900 font-black text-sm shrink-0">
            إ
          </div>
        </div>
      </div>
    </header>
  );
}
