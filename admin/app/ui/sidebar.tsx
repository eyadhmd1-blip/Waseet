'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '../login/actions';

const NAV_GROUPS = [
  {
    label: 'الرئيسية',
    items: [
      { href: '/',       label: 'لوحة التحكم',       icon: '📊' },
      { href: '/reports', label: 'التقارير',           icon: '📈' },
    ],
  },
  {
    label: 'المستخدمون',
    items: [
      { href: '/users',     label: 'العملاء',    icon: '👤' },
      { href: '/providers', label: 'المزودون',   icon: '🔧' },
    ],
  },
  {
    label: 'العمليات',
    items: [
      { href: '/requests',  label: 'الطلبات',        icon: '📋' },
      { href: '/contracts', label: 'عقود دورية',     icon: '🔄' },
    ],
  },
  {
    label: 'الحماية والسلامة',
    items: [
      { href: '/abuse-reports',    label: 'البلاغات',         icon: '🚩' },
      { href: '/cancellations',    label: 'تنبيهات الإلغاء',  icon: '⚠️' },
      { href: '/category-limits',  label: 'حدود الأسعار',     icon: '💰' },
    ],
  },
  {
    label: 'المحتوى',
    items: [
      { href: '/categories',  label: 'التصنيفات',          icon: '🗂️' },
      { href: '/suggestions', label: 'اقتراحات الخدمات',   icon: '💡' },
    ],
  },
  {
    label: 'الإدارة',
    items: [
      { href: '/notifications', label: 'الإشعارات',      icon: '🔔' },
      { href: '/audit',         label: 'سجل النشاط',    icon: '🔍' },
      { href: '/settings',      label: 'الإعدادات',      icon: '⚙️' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col min-h-screen">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center text-slate-900 font-black text-sm">و</div>
          <div>
            <div className="text-amber-400 font-bold text-base leading-none tracking-wide">وسيط</div>
            <div className="text-slate-600 text-[10px] mt-0.5">لوحة الإدارة</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-4 overflow-y-auto">
        {NAV_GROUPS.map(({ label, items }) => (
          <div key={label}>
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mb-1.5">
              {label}
            </p>
            <div className="flex flex-col gap-0.5">
              {items.map(({ href, label: itemLabel, icon }) => {
                const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
                      ${active
                        ? 'bg-amber-400/15 text-amber-400 shadow-sm'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                  >
                    <span className="text-base w-5 text-center">{icon}</span>
                    <span>{itemLabel}</span>
                    {active && (
                      <span className="mr-auto w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer + Logout */}
      <div className="px-5 py-4 border-t border-slate-800 flex flex-col gap-3">
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-red-950/40 hover:text-red-400 transition-colors"
          >
            <span className="text-base">🚪</span>
            <span>تسجيل الخروج</span>
          </button>
        </form>
        <div className="text-slate-700 text-[10px] leading-relaxed">
          <div>Waseet Admin v1.0</div>
        </div>
      </div>
    </aside>
  );
}
