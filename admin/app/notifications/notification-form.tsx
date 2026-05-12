'use client';

import { useState, useEffect, useTransition } from 'react';
import { sendBroadcast, estimateAudience, type Segment } from './actions';

const CITIES = ['عمّان', 'الزرقاء', 'إربد', 'العقبة', 'السلط', 'مادبا', 'الكرك', 'جرش'];

// Segments that have meaningful city filtering
const CITY_ENABLED: Segment[] = [
  'all', 'clients', 'providers',
  'lapsed_providers', 'new_providers', 'new_clients', 'inactive_users',
];

export function NotificationForm() {
  const [title,       setTitle]       = useState('');
  const [body,        setBody]        = useState('');
  const [segment,     setSegment]     = useState<Segment>('all');
  const [city,        setCity]        = useState('');
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState<{ sent: number; tokens: number; errors: string[] } | null>(null);
  const [error,       setError]       = useState('');
  const [estimate,    setEstimate]    = useState<number | null>(null);
  const [estimating,  setEstimating]  = useState(false);

  const cityEnabled = CITY_ENABLED.includes(segment);

  // Auto-fetch estimate whenever segment or city changes (400ms debounce)
  useEffect(() => {
    let cancelled = false;
    setEstimate(null);
    setEstimating(true);

    const timer = setTimeout(async () => {
      try {
        const res = await estimateAudience({
          segment,
          city: cityEnabled && city ? city : undefined,
        });
        if (!cancelled) setEstimate(res.count);
      } catch {
        if (!cancelled) setEstimate(null);
      } finally {
        if (!cancelled) setEstimating(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [segment, city, cityEnabled]);

  // Clear city when switching to a segment that doesn't support it
  useEffect(() => {
    if (!cityEnabled) setCity('');
  }, [cityEnabled]);

  async function handleSend() {
    if (!title.trim() || !body.trim()) {
      setError('العنوان والنص مطلوبان');
      return;
    }
    if (estimate === 0) {
      setError('لا يوجد مستخدمون في هذا القطاع — اختر قطاعاً آخر');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const res = await sendBroadcast({
        title:   title.trim(),
        body:    body.trim(),
        segment,
        city:    cityEnabled && city ? city : undefined,
      });
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
        <select
          value={segment}
          onChange={e => setSegment(e.target.value as Segment)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-amber-400/50 text-right"
        >
          <optgroup label="عام">
            <option value="all">الجميع</option>
            <option value="clients">العملاء فقط</option>
            <option value="providers">المقدمون فقط</option>
          </optgroup>
          <optgroup label="الاشتراكات">
            <option value="subscribed_providers">المقدمون المشتركون</option>
            <option value="lapsed_providers">منتهو الاشتراك — أقل من 30 يوم</option>
            <option value="dormant_providers">خاملون — 31 إلى 90 يوم</option>
            <option value="no_portfolio_providers">مشتركون بلا بورتفوليو</option>
          </optgroup>
          <optgroup label="جدد">
            <option value="new_providers">مقدمون جدد — آخر 7 أيام</option>
            <option value="new_clients">عملاء جدد — آخر 7 أيام</option>
          </optgroup>
          <optgroup label="النشاط">
            <option value="inactive_users">غير نشطين — 21 يوم أو أكثر</option>
          </optgroup>
        </select>

        {/* Estimate badge */}
        <div className="mt-2 flex items-center justify-end gap-2 min-h-[20px]">
          {estimating ? (
            <span className="text-slate-600 text-xs">جارٍ الحساب...</span>
          ) : estimate !== null ? (
            <>
              <span className="text-slate-500 text-xs">المستهدفون:</span>
              <span className={`text-sm font-bold ${estimate === 0 ? 'text-red-400' : 'text-amber-400'}`}>
                {estimate.toLocaleString('ar-JO')} مستخدم
              </span>
            </>
          ) : null}
        </div>
      </div>

      {/* City filter */}
      <div>
        <label className="text-slate-400 text-xs mb-1.5 block text-right">تصفية بالمدينة (اختياري)</label>
        <select
          value={city}
          onChange={e => setCity(e.target.value)}
          disabled={!cityEnabled}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none focus:border-amber-400/50 text-right disabled:opacity-40"
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
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-right space-y-1">
          <p className="text-emerald-400 text-sm font-semibold">
            تم الإرسال — {result.sent.toLocaleString('ar-JO')} مستخدم مستهدف
          </p>
          <p className="text-slate-400 text-xs">
            📱 أجهزة لديها token: {result.tokens}
            {result.tokens === 0 && ' — لا توجد أجهزة مسجّلة بعد'}
          </p>
          {result.errors.length > 0 && (
            <p className="text-amber-400 text-xs">⚠️ أخطاء Expo: {result.errors.length}</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        {estimate !== null && !estimating && estimate > 0 && (
          <span className="text-slate-600 text-xs">
            سيُرسَل لـ {estimate.toLocaleString('ar-JO')} مستخدم
          </span>
        )}
        <button
          onClick={handleSend}
          disabled={loading || !title.trim() || !body.trim() || estimate === 0}
          className="mr-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm transition-colors disabled:opacity-40"
        >
          {loading ? 'جارٍ الإرسال...' : 'إرسال الإشعار'}
        </button>
      </div>
    </div>
  );
}
