'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('waseet-theme');
    if (saved === 'light') setTheme('light');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('waseet-theme', next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'تفعيل المظهر الفاتح' : 'تفعيل المظهر الداكن'}
      className="w-8 h-8 rounded-xl flex items-center justify-center text-base
        text-slate-500 hover:text-slate-300 transition-colors"
      style={{ background: 'var(--accent-glow)' }}
      title={theme === 'dark' ? 'مظهر فاتح' : 'مظهر داكن'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
