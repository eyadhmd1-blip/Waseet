'use client';

import { usePathname } from 'next/navigation';

const PAGE_TITLES: Record<string, { label: string; icon: string }> = {
  '/':               { label: 'لوحة التحكم',      icon: '📊' },
  '/users':          { label: 'إدارة المستخدمين',  icon: '👥' },
  '/providers':      { label: 'إدارة المزودين',    icon: '🔧' },
  '/requests':       { label: 'إدارة الطلبات',     icon: '📋' },
  '/contracts':      { label: 'العقود الدورية',    icon: '🔄' },
  '/reports':        { label: 'التقارير والإحصائيات', icon: '📈' },
  '/notifications':  { label: 'الإشعارات',         icon: '🔔' },
  '/audit':          { label: 'سجل النشاط',        icon: '🔍' },
  '/settings':       { label: 'إعدادات المنصة',    icon: '⚙️' },
};

export function TopBar() {
  const pathname = usePathname();
  const page = PAGE_TITLES[pathname] ?? { label: pathname, icon: '📄' };
  const now = new Date().toLocaleDateString('ar-JO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <header className="h-14 shrink-0 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-2 text-slate-500 text-sm">
        <span>{now}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-base">{page.icon}</span>
        <h1 className="text-slate-100 font-bold text-base">{page.label}</h1>
      </div>
    </header>
  );
}
