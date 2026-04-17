'use client';

import { useState } from 'react';
import { sendBroadcast } from './actions';

const SEGMENTS = [
  { value: 'all',                  label: 'الجميع' },
  { value: 'clients',              label: 'العملاء فقط' },
  { value: 'providers',            label: 'المزودون فقط' },
  { value: 'subscribed_providers', label: 'المزودون المشتركون' },
];

const CITIES = ['عمّان', 'الزرقاء', 'إربد', 'العقبة', 'السلط', 'مادبا', 'الكرك', 'جرش'];

export function NotificationForm() {
  const [title,    setTitle]    = useState('');
  const [body,     setBody]     = useState('');
  const [segment,  setSegment]  = useState<'all' | 'clients' | 'providers' | 'subscribed_providers'>('all');
  const [city,     setCity]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<{ sent: number } | null>(null);
  const [error,    setError]    = useState('');

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      setError('العنوان والنص مطلوبان');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const res = await sendBroadcast({ title: title.trim(), body: body.trim(), segment, city: city || undefined });
      setResult(res);
      setTitle('');
      setBody('');
    } catch {
      setError('حدث خطأ أثناء الإرسال');
    }
    setLoading(false);
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
      <h2 className="text-slate-200 font-semibold text-lg">إرسال إشعار</h2>

      {/* Segment */}
      <div>
        <label className="text-slate-400 text-xs mb-1.5 block text-right">الجمهور المستهدف</label>
        <div className="flex gap-2 flex-wrap flex-row-reverse">
          {SEGMENTS.map(s => (
            <button
              key={s.value}
              onClick={() => setSegment(s.value as typeof segment)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                segment === s.value
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* City filter */}
      <div>
        <label className="text-slate-400 text-xs mb-1.5 block text-right">تصفية بالمدينة (اختياري)</label>
        <select
          value={city}
          onChange={e => setCity(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-amber-400/50 text-right"
          disabled={segment === 'subscribed_providers'}
        >
          <option value="">كل المدن</option>
          {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Title */}
      <div>
        <label className="text-slate-400 text-xs mb-1.5 block text-right">عنوان الإشعار</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="مثال: عرض خاص لهذا الأسبوع"
          maxLength={100}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-amber-400/50 text-right"
        />
      </div>

      {/* Body */}
      <div>
        <label className="text-slate-400 text-xs mb-1.5 block text-right">نص الإشعار</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="اكتب رسالتك هنا..."
          rows={4}
          maxLength={500}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 resize-none outline-none focus:border-amber-400/50 text-right"
        />
        <div className="text-right text-slate-600 text-xs mt-1">{body.length}/500</div>
      </div>

      {error && (
        <p className="text-red-400 text-sm text-right">{error}</p>
      )}

      {result && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-right">
          <p className="text-emerald-400 text-sm font-semibold">
            تم الإرسال بنجاح — وصل إلى {result.sent} مستخدم
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSend}
          disabled={loading || !title.trim() || !body.trim()}
          className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm transition-colors disabled:opacity-40"
        >
          {loading ? 'جارٍ الإرسال...' : 'إرسال الإشعار'}
        </button>
      </div>
    </div>
  );
}
