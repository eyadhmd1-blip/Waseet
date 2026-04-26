'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── Toggle active/inactive ────────────────────────────────────

export function ToggleCategory({ id, isActive }: { id: string; isActive: boolean }) {
  const [loading, setLoading] = useState(false);
  const [active, setActive]   = useState(isActive);

  const toggle = async () => {
    setLoading(true);
    await sb.from('service_categories').update({ is_active: !active }).eq('id', id);
    setActive(v => !v);
    setLoading(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
        active ? 'bg-amber-400' : 'bg-slate-700'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          active ? 'translate-x-4' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ── Add new category form ─────────────────────────────────────

const GROUPS = [
  { slug: 'maintenance',   name: 'صيانة المنازل' },
  { slug: 'cleaning',      name: 'تنظيف ونقل' },
  { slug: 'technical',     name: 'الخدمات الفنية' },
  { slug: 'health_beauty', name: 'الصحة والعناية' },
  { slug: 'events',        name: 'المناسبات والفعاليات' },
  { slug: 'education',     name: 'تعليم وتدريب' },
  { slug: 'freelance',     name: 'تصميم وأعمال حرة' },
  { slug: 'handicrafts',   name: 'الحِرَف اليدوية والتقليدية' },
  { slug: 'pets',          name: 'الحيوانات الأليفة' },
  { slug: 'car_services',  name: 'صيانة السيارات' },
];

export function AddCategoryForm({ maxSort }: { maxSort: number }) {
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const [slug,    setSlug]    = useState('');
  const [nameAr,  setNameAr]  = useState('');
  const [nameEn,  setNameEn]  = useState('');
  const [icon,    setIcon]    = useState('wrench');
  const [group,   setGroup]   = useState('maintenance');

  const handleAdd = async () => {
    if (!slug || !nameAr) { setError('الاسم العربي والـ slug مطلوبان'); return; }
    setLoading(true); setError(''); setSuccess('');
    const { error: dbErr } = await sb.from('service_categories').insert({
      slug: slug.trim().toLowerCase().replace(/\s+/g, '_'),
      name_ar:   nameAr.trim(),
      name_en:   nameEn.trim() || null,
      icon:      icon.trim() || 'wrench',
      group_slug: group,
      group_ar:  GROUPS.find(g => g.slug === group)?.name ?? group,
      group_en:  null,
      sort_order: maxSort + 1,
    });
    setLoading(false);
    if (dbErr) { setError(dbErr.message); return; }
    setSuccess('تمت الإضافة بنجاح!');
    setSlug(''); setNameAr(''); setNameEn(''); setIcon('wrench');
    setTimeout(() => { setSuccess(''); setOpen(false); window.location.reload(); }, 1200);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-amber-400 text-slate-900 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-amber-300 transition-colors"
      >
        <span className="text-base">+</span> إضافة تصنيف
      </button>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 mt-4 text-right space-y-3" dir="rtl">
      <div className="flex justify-between items-center">
        <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
        <h3 className="text-slate-200 font-semibold text-sm">إضافة تصنيف جديد</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1">الاسم العربي *</label>
          <input value={nameAr} onChange={e => setNameAr(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder:text-slate-600"
            placeholder="مثال: تصليح أجهزة طبية" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">الاسم الإنجليزي</label>
          <input value={nameEn} onChange={e => setNameEn(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder:text-slate-600"
            placeholder="Medical Device Repair" dir="ltr" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Slug *</label>
          <input value={slug} onChange={e => setSlug(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm font-mono placeholder:text-slate-600"
            placeholder="medical_device_repair" dir="ltr" />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Icon (lucide slug)</label>
          <input value={icon} onChange={e => setIcon(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm font-mono placeholder:text-slate-600"
            placeholder="wrench" dir="ltr" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-slate-500 block mb-1">المجموعة *</label>
          <select value={group} onChange={e => setGroup(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm">
            {GROUPS.map(g => <option key={g.slug} value={g.slug}>{g.name}</option>)}
          </select>
        </div>
      </div>

      {error   && <p className="text-red-400 text-xs">{error}</p>}
      {success && <p className="text-emerald-400 text-xs">{success}</p>}

      <button
        onClick={handleAdd}
        disabled={loading}
        className="w-full bg-amber-400 text-slate-900 text-sm font-semibold py-2.5 rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-50"
      >
        {loading ? 'جارٍ الإضافة...' : 'إضافة التصنيف'}
      </button>
    </div>
  );
}
