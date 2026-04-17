'use client';

import { useState } from 'react';

export function CategoryLimitsForm({
  id,
  slug,
  nameAr,
  minBid,
  maxBid,
  isActive,
}: {
  id: string;
  slug: string;
  nameAr: string;
  minBid: number | null;
  maxBid: number | null;
  isActive: boolean;
}) {
  const [min, setMin]       = useState(minBid?.toString() ?? '');
  const [max, setMax]       = useState(maxBid?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  const handleSave = async () => {
    const minVal = min.trim() === '' ? null : parseFloat(min);
    const maxVal = max.trim() === '' ? null : parseFloat(max);

    if (minVal !== null && isNaN(minVal)) { setError('الحد الأدنى غير صالح'); return; }
    if (maxVal !== null && isNaN(maxVal)) { setError('الحد الأقصى غير صالح'); return; }
    if (minVal !== null && maxVal !== null && maxVal <= minVal) {
      setError('يجب أن يكون الحد الأقصى أكبر من الأدنى');
      return;
    }

    setError('');
    setSaving(true);

    const res = await fetch('/api/category-limits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, min_bid: minVal, max_bid: maxVal }),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError('فشل الحفظ');
    }
  };

  return (
    <div className="px-5 py-4 flex items-center gap-4 flex-row-reverse">
      {/* Category name */}
      <div className="flex-1 text-right">
        <div className="text-slate-200 text-sm font-medium">{nameAr}</div>
        <div className="text-slate-600 text-xs">{slug}</div>
      </div>

      {/* Min bid */}
      <div className="flex items-center gap-1.5">
        <span className="text-slate-600 text-xs">د.أ</span>
        <input
          type="number"
          min="0"
          step="0.5"
          placeholder="—"
          value={min}
          onChange={e => setMin(e.target.value)}
          className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-sm text-center focus:outline-none focus:border-amber-500"
        />
        <span className="text-slate-500 text-xs">أدنى</span>
      </div>

      {/* Max bid */}
      <div className="flex items-center gap-1.5">
        <span className="text-slate-600 text-xs">د.أ</span>
        <input
          type="number"
          min="0"
          step="0.5"
          placeholder="—"
          value={max}
          onChange={e => setMax(e.target.value)}
          className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-sm text-center focus:outline-none focus:border-amber-500"
        />
        <span className="text-slate-500 text-xs">أقصى</span>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-2">
        {error && <span className="text-red-400 text-xs">{error}</span>}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
            saved
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
          }`}
        >
          {saving ? '...' : saved ? 'تم الحفظ ✓' : 'حفظ'}
        </button>
      </div>
    </div>
  );
}
