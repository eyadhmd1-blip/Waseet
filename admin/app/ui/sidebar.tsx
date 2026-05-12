'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { logoutAction } from '../login/actions';

// ── Flags badge (polls every 30s) ─────────────────────────────

function FlagsBadge() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const res = await fetch('/api/flags/count');
        if (!res.ok || !mounted) return;
        const { count: c } = await res.json();
        setCount(c ?? 0);
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  if (count === 0) return null;
  return (
    <span className="mr-auto min-w-[1.35rem] h-5 px-1.5 rounded-full bg-rose-500
      text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-lg shadow-rose-500/30">
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ── Nav structure ─────────────────────────────────────────────

type NavItem = {
  href:    string;
  label:   string;
  icon:    string;
  iconBg:  string;
  badge?:  'flags';
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'الرئيسية',
    items: [
      { href: '/',          label: 'لوحة التحكم',     icon: '📊', iconBg: 'bg-violet-500/20 text-violet-300' },
      { href: '/reports',   label: 'التقارير',         icon: '📈', iconBg: 'bg-blue-500/20 text-blue-300'    },
      { href: '/analytics', label: 'العرض والطلب',     icon: '⚖️', iconBg: 'bg-amber-500/20 text-amber-300'  },
      { href: '/system',    label: 'صحة النظام',       icon: '🖥️', iconBg: 'bg-emerald-500/20 text-emerald-300' },
    ],
  },
  {
    label: 'المستخدمون',
    items: [
      { href: '/users',     label: 'العملاء',    icon: '👤', iconBg: 'bg-sky-500/20 text-sky-300'     },
      { href: '/providers', label: 'المقدمون',   icon: '🔧', iconBg: 'bg-amber-500/20 text-amber-300' },
    ],
  },
  {
    label: 'العمليات',
    items: [
      { href: '/requests',  label: 'الطلبات',          icon: '📋', iconBg: 'bg-indigo-500/20 text-indigo-300'  },
      { href: '/contracts', label: 'عقود دورية',       icon: '🔄', iconBg: 'bg-teal-500/20 text-teal-300'     },
      { href: '/support',   label: 'الدعم والمدفوعات', icon: '💳', iconBg: 'bg-emerald-500/20 text-emerald-300'},
    ],
  },
  {
    label: 'الحماية والسلامة',
    items: [
      { href: '/provider-flags',  label: 'مراقبة المقدمين',   icon: '🚨', iconBg: 'bg-rose-500/20 text-rose-300',     badge: 'flags' },
      { href: '/abuse-reports',   label: 'البلاغات',           icon: '🚩', iconBg: 'bg-red-500/20 text-red-300'        },
      { href: '/cancellations',   label: 'تنبيهات الإلغاء',    icon: '⚠️', iconBg: 'bg-orange-500/20 text-orange-300'  },
      { href: '/category-limits', label: 'حدود الأسعار',       icon: '💰', iconBg: 'bg-lime-500/20 text-lime-300'      },
    ],
  },
  {
    label: 'المحتوى',
    items: [
      { href: '/categories',  label: 'التصنيفات',          icon: '🗂️', iconBg: 'bg-purple-500/20 text-purple-300' },
      { href: '/suggestions', label: 'اقتراحات الخدمات',   icon: '💡', iconBg: 'bg-yellow-500/20 text-yellow-300' },
    ],
  },
  {
    label: 'الإدارة',
    items: [
      { href: '/notifications', label: 'الإشعارات',   icon: '🔔', iconBg: 'bg-cyan-500/20 text-cyan-300'   },
      { href: '/audit',         label: 'سجل النشاط',  icon: '🔍', iconBg: 'bg-slate-500/20 text-slate-400' },
      { href: '/settings',      label: 'الإعدادات',   icon: '⚙️', iconBg: 'bg-gray-500/20 text-gray-400'   },
    ],
  },
];

// ── Sidebar component ─────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-60 shrink-0 flex flex-col min-h-screen"
      style={{
        background: 'var(--sidebar-bg)',
        borderLeft: '1px solid var(--sidebar-border)',
      }}
    >
      {/* ── Logo ──────────────────────────────────────────────── */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
        <div className="flex items-center gap-3">
          {/* Amber icon */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500
            flex items-center justify-center text-slate-900 font-black text-base shadow-lg shadow-amber-500/25">
            و
          </div>
          <div>
            <div className="text-amber-400 font-black text-base leading-none tracking-wide">وسيط</div>
            <div className="text-slate-600 text-[10px] mt-0.5 font-medium">لوحة الإدارة</div>
          </div>
          {/* Subtle pulse indicator */}
          <div className="mr-auto flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>
      </div>

      {/* ── Nav ───────────────────────────────────────────────── */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-5 overflow-y-auto">
        {NAV_GROUPS.map(({ label, items }) => (
          <div key={label}>
            <p className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.12em] px-3 mb-2">
              {label}
            </p>
            <div className="flex flex-col gap-0.5">
              {items.map(({ href, label: itemLabel, icon, iconBg, badge }) => {
                const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium
                      transition-all duration-150 group
                      ${active
                        ? 'text-violet-300'
                        : 'text-slate-500 hover:text-slate-200'
                      }`}
                    style={active
                      ? { background: 'rgba(124,58,237,0.14)', border: '1px solid rgba(124,58,237,0.22)' }
                      : { background: 'transparent', border: '1px solid transparent' }
                    }
                  >
                    {/* Icon pill */}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0
                      transition-transform duration-200 group-hover:scale-105
                      ${active ? 'bg-violet-500/25 text-violet-300' : iconBg}`}>
                      {icon}
                    </div>

                    <span className="flex-1 leading-none">{itemLabel}</span>

                    {/* Flags badge */}
                    {badge === 'flags' && <FlagsBadge />}

                    {/* Active dot (no badge) */}
                    {active && badge !== 'flags' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0 shadow-sm shadow-violet-400/50" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ────────────────────────────────────────────── */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        {/* User info */}
        <div className="flex items-center gap-2.5 px-2 py-2.5 rounded-xl mb-2"
          style={{ background: 'rgba(124,58,237,0.06)' }}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500
            flex items-center justify-center text-slate-900 font-black text-sm shrink-0">
            إ
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-slate-200 text-xs font-semibold truncate">Eyad Admin</div>
            <div className="text-slate-600 text-[10px]">مدير النظام</div>
          </div>
        </div>

        {/* Logout */}
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm
              text-slate-600 hover:bg-red-950/30 hover:text-red-400 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm bg-slate-800/50">
              🚪
            </div>
            <span>تسجيل الخروج</span>
          </button>
        </form>

        <div className="text-slate-700 text-[9px] text-center mt-2 leading-relaxed">
          Waseet Admin v1.0
        </div>
      </div>
    </aside>
  );
}
