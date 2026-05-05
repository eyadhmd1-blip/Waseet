'use client';

import { useRouter } from 'next/navigation';
import { useRef, useTransition } from 'react';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key:     string;
  label:   string;
  options: FilterOption[];
}

interface FilterBarProps {
  current:            Record<string, string>;
  searchPlaceholder?: string;
  filters:            FilterConfig[];
}

export function FilterBar({ current, searchPlaceholder = 'بحث...', filters }: FilterBarProps) {
  const router              = useRouter();
  const [pending, startT]   = useTransition();
  const debounceRef         = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const push = (updates: Record<string, string>) => {
    const params = new URLSearchParams(current);
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    // reset to page 1 on any filter change
    params.delete('page');
    startT(() => router.push(`?${params.toString()}`));
  };

  const hasFilters = Object.values(current).some(Boolean);

  return (
    <div className="flex flex-wrap gap-3 items-center" dir="rtl">

      {/* Search */}
      <div className="relative">
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
        <input
          type="text"
          placeholder={searchPlaceholder}
          defaultValue={current.q ?? ''}
          onChange={e => {
            clearTimeout(debounceRef.current);
            const v = e.target.value;
            debounceRef.current = setTimeout(() => push({ q: v }), 400);
          }}
          className="bg-slate-800 border border-slate-700 rounded-xl pr-9 pl-4 py-2 text-sm text-slate-200
                     placeholder-slate-500 focus:outline-none focus:border-amber-500 w-64"
        />
      </div>

      {/* Filter selects */}
      {filters.map(f => (
        <select
          key={f.key}
          value={current[f.key] ?? ''}
          onChange={e => push({ [f.key]: e.target.value })}
          className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200
                     focus:outline-none focus:border-amber-500 cursor-pointer"
        >
          <option value="">{f.label}: الكل</option>
          {f.options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ))}

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={() => push(Object.fromEntries(Object.keys(current).map(k => [k, ''])))}
          className="text-xs text-slate-400 hover:text-red-400 transition-colors px-2 py-1"
        >
          ✕ مسح الفلاتر
        </button>
      )}

      {/* Loading indicator */}
      {pending && (
        <span className="text-xs text-amber-400 animate-pulse">جارٍ البحث...</span>
      )}
    </div>
  );
}
