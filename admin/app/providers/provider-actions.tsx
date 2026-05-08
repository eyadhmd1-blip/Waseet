'use client';

import { useState } from 'react';
import { ConfirmModal } from '../ui/confirm-modal';
import {
  suspendProvider, unsuspendProvider, verifyProvider, unverifyProvider,
  overrideTier, adjustCredits, manualActivateSubscription,
} from './actions';

const TIERS = ['new', 'rising', 'trusted', 'expert', 'elite'] as const;
const TIER_LABELS: Record<string, string> = {
  new: 'جديد', rising: 'صاعد', trusted: 'موثوق', expert: 'خبير', elite: 'نخبة',
};

const SUB_TIERS = ['trial', 'basic', 'pro', 'premium'] as const;
const SUB_LABELS: Record<string, string> = {
  trial: 'تجريبية', basic: 'أساسية', pro: 'محترف', premium: 'نخبة',
};
const SUB_CREDITS: Record<string, string> = {
  trial: '10 رصيد', basic: '20 رصيد', pro: '50 رصيد', premium: 'غير محدود',
};
const SUB_PRICE: Record<string, string> = {
  trial: 'مجاناً', basic: '5 JOD', pro: '12 JOD', premium: '22 JOD',
};
const SUB_DEFAULT_AMOUNT: Record<string, number> = {
  trial: 0, basic: 5, pro: 12, premium: 22,
};
const DURATION_OPTIONS = [1, 2, 3, 6, 12] as const;
const METHOD_LABELS: Record<string, string> = {
  cash: 'نقدي', bank_transfer: 'حوالة بنكية', other: 'أخرى',
};

interface ProviderActionsProps {
  providerId:     string;
  userId:         string;
  name:           string;
  isActive:       boolean;
  badgeVerified:  boolean;
  currentTier:    string;
  bidCredits:     number;
  isSubscribed:   boolean;
  currentSubTier: string | null;
  trialUsed:      boolean;
}

export function ProviderActions({
  providerId, userId, name, isActive, badgeVerified, currentTier, bidCredits,
  isSubscribed, currentSubTier, trialUsed,
}: ProviderActionsProps) {
  const [open,        setOpen]        = useState(false);
  const [modal,       setModal]       = useState<'suspend' | 'unsuspend' | 'verify' | 'unverify' | 'tier' | 'credits' | 'subscription' | null>(null);
  const [reason,      setReason]      = useState('');
  const [tier,        setTier]        = useState(currentTier);
  const [creditDelta, setCreditDelta] = useState('');
  const [loading,     setLoading]     = useState(false);

  // Subscription modal state
  const [subTier,   setSubTier]   = useState<string>('basic');
  const [subMonths, setSubMonths] = useState<number>(1);
  const [subAmount, setSubAmount] = useState<string>('5');
  const [subMethod, setSubMethod] = useState<string>('cash');
  const [subRef,    setSubRef]    = useState('');
  const [subNotes,  setSubNotes]  = useState('');

  function openSubscriptionModal() {
    const defaultTier = trialUsed ? 'basic' : 'basic';
    setSubTier(defaultTier);
    setSubMonths(1);
    setSubAmount(String(SUB_DEFAULT_AMOUNT[defaultTier]));
    setSubMethod('cash');
    setSubRef('');
    setSubNotes('');
    setOpen(false);
    setModal('subscription');
  }

  function onSubTierChange(t: string) {
    setSubTier(t);
    setSubAmount(String(SUB_DEFAULT_AMOUNT[t] * subMonths));
  }

  function onSubMonthsChange(m: number) {
    setSubMonths(m);
    setSubAmount(String(SUB_DEFAULT_AMOUNT[subTier] * m));
  }

  async function run() {
    setLoading(true);
    try {
      if (modal === 'suspend')   await suspendProvider(providerId, userId, name, reason);
      if (modal === 'unsuspend') await unsuspendProvider(providerId, name);
      if (modal === 'verify')    await verifyProvider(providerId, name);
      if (modal === 'unverify')  await unverifyProvider(providerId, name);
      if (modal === 'tier')      await overrideTier(providerId, name, tier, currentTier);
      if (modal === 'credits')   await adjustCredits(providerId, name, parseInt(creditDelta, 10), reason);
      if (modal === 'subscription') {
        await manualActivateSubscription(
          providerId, name, subTier, subMonths,
          parseFloat(subAmount) || 0, subMethod, subRef.trim(), subNotes.trim(),
        );
      }
    } finally {
      setLoading(false);
      setModal(null);
      setOpen(false);
      setReason('');
      setCreditDelta('');
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors font-semibold"
      >
        إجراء ▾
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-40 overflow-hidden text-right">
            {isActive ? (
              <button className="w-full px-4 py-2.5 text-sm text-red-400 hover:bg-slate-700 transition-colors text-right"
                onClick={() => { setOpen(false); setModal('suspend'); }}>
                🚫 إيقاف مؤقت
              </button>
            ) : (
              <button className="w-full px-4 py-2.5 text-sm text-emerald-400 hover:bg-slate-700 transition-colors text-right"
                onClick={() => { setOpen(false); setModal('unsuspend'); }}>
                ✅ رفع الإيقاف
              </button>
            )}
            {badgeVerified ? (
              <button className="w-full px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-700 transition-colors text-right"
                onClick={() => { setOpen(false); setModal('unverify'); }}>
                ✕ سحب التوثيق
              </button>
            ) : (
              <button className="w-full px-4 py-2.5 text-sm text-sky-400 hover:bg-slate-700 transition-colors text-right"
                onClick={() => { setOpen(false); setModal('verify'); }}>
                ✓ منح توثيق
              </button>
            )}
            <button className="w-full px-4 py-2.5 text-sm text-amber-400 hover:bg-slate-700 transition-colors text-right border-t border-slate-700"
              onClick={() => { setOpen(false); setModal('tier'); }}>
              ⭐ تعديل الرتبة
            </button>
            <button className="w-full px-4 py-2.5 text-sm text-violet-400 hover:bg-slate-700 transition-colors text-right border-t border-slate-700"
              onClick={() => { setOpen(false); setModal('credits'); }}>
              💳 إدارة الرصيد
            </button>
            <button className="w-full px-4 py-2.5 text-sm text-emerald-400 hover:bg-slate-700 transition-colors text-right border-t border-slate-700"
              onClick={openSubscriptionModal}>
              📦 تفعيل اشتراك
            </button>
          </div>
        </>
      )}

      {/* Suspend modal */}
      {modal === 'suspend' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm mx-4 text-right shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 mb-1">إيقاف مزود مؤقتاً</h3>
            <p className="text-sm text-slate-400 mb-4">{name}</p>
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 resize-none outline-none focus:border-amber-400/50 mb-4"
              rows={3} placeholder="سبب الإيقاف (مطلوب)..."
              value={reason} onChange={e => setReason(e.target.value)}
            />
            <div className="flex gap-3 flex-row-reverse">
              <button onClick={run} disabled={loading || !reason.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-red-500 hover:bg-red-600 text-white disabled:opacity-40 transition-all">
                {loading ? '...' : 'إيقاف'}
              </button>
              <button onClick={() => setModal(null)}
                className="px-5 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-slate-800 transition-all">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Override tier modal */}
      {modal === 'tier' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm mx-4 text-right shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 mb-1">تعديل رتبة المزود</h3>
            <p className="text-sm text-slate-400 mb-4">{name}</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {TIERS.map(t => (
                <button key={t}
                  onClick={() => setTier(t)}
                  className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all
                    ${tier === t ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                  {TIER_LABELS[t]}
                </button>
              ))}
            </div>
            <div className="flex gap-3 flex-row-reverse">
              <button onClick={run} disabled={loading || tier === currentTier}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-amber-400 hover:bg-amber-300 text-slate-900 disabled:opacity-40 transition-all">
                {loading ? '...' : 'حفظ'}
              </button>
              <button onClick={() => setModal(null)}
                className="px-5 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-slate-800 transition-all">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credits modal */}
      {modal === 'credits' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm mx-4 text-right shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 mb-1">إدارة رصيد المزايدة</h3>
            <p className="text-sm text-slate-400 mb-1">{name}</p>
            <p className="text-xs text-slate-500 mb-4">الرصيد الحالي: <span className="text-violet-400 font-bold">{bidCredits} رصيد</span></p>
            <div className="mb-3">
              <label className="text-xs text-slate-500 mb-1 block">الكمية (موجب = إضافة، سالب = خصم)</label>
              <input
                type="number"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-violet-400/50"
                placeholder="مثال: 10 أو -5"
                value={creditDelta}
                onChange={e => setCreditDelta(e.target.value)}
              />
              {creditDelta && !isNaN(parseInt(creditDelta, 10)) && (
                <p className="text-xs mt-1.5 text-slate-500">
                  بعد التعديل: <span className={parseInt(creditDelta, 10) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {Math.max(0, bidCredits + parseInt(creditDelta, 10))} رصيد
                  </span>
                </p>
              )}
            </div>
            <div className="mb-4">
              <label className="text-xs text-slate-500 mb-1 block">السبب (مطلوب)</label>
              <input
                type="text"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-violet-400/50"
                placeholder="مثال: تعويض عن خطأ تقني"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>
            <div className="flex gap-3 flex-row-reverse">
              <button
                onClick={run}
                disabled={loading || !reason.trim() || !creditDelta || isNaN(parseInt(creditDelta, 10)) || parseInt(creditDelta, 10) === 0}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-violet-500 hover:bg-violet-400 text-white disabled:opacity-40 transition-all"
              >
                {loading ? '...' : 'تطبيق'}
              </button>
              <button onClick={() => { setModal(null); setCreditDelta(''); setReason(''); }}
                className="px-5 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-slate-800 transition-all">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual subscription activation modal */}
      {modal === 'subscription' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md text-right shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-lg font-bold text-slate-100 mb-1">تفعيل اشتراك يدوي</h3>
            <p className="text-sm text-slate-400 mb-1">{name}</p>
            {isSubscribed && currentSubTier && (
              <p className="text-xs text-amber-400/80 mb-4">
                ⚠️ الاشتراك الحالي ({SUB_LABELS[currentSubTier] ?? currentSubTier}) سيُستبدل
              </p>
            )}

            {/* Tier selector */}
            <div className="mb-5">
              <label className="text-xs text-slate-500 mb-2 block">الباقة</label>
              <div className="grid grid-cols-2 gap-2">
                {SUB_TIERS.map(t => {
                  const isTrialDisabled = t === 'trial' && trialUsed;
                  return (
                    <button
                      key={t}
                      onClick={() => !isTrialDisabled && onSubTierChange(t)}
                      disabled={isTrialDisabled}
                      className={`px-3 py-3 rounded-xl text-sm font-semibold transition-all text-right border
                        ${subTier === t
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : isTrialDisabled
                            ? 'bg-slate-800/30 border-slate-700/30 text-slate-600 cursor-not-allowed'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                    >
                      <div className="font-bold">{SUB_LABELS[t]}</div>
                      <div className="text-xs opacity-70 mt-0.5">{SUB_CREDITS[t]} · {SUB_PRICE[t]}</div>
                      {isTrialDisabled && <div className="text-xs text-slate-600 mt-0.5">مُستخدمة</div>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duration */}
            <div className="mb-5">
              <label className="text-xs text-slate-500 mb-2 block">المدة</label>
              <div className="flex gap-2 flex-wrap">
                {DURATION_OPTIONS.map(m => (
                  <button
                    key={m}
                    onClick={() => onSubMonthsChange(m)}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all
                      ${subMonths === m
                        ? 'bg-emerald-500 text-slate-900'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  >
                    {m === 1 ? 'شهر' : m === 12 ? 'سنة' : `${m} أشهر`}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount paid */}
            <div className="mb-4">
              <label className="text-xs text-slate-500 mb-1 block">المبلغ المدفوع (دينار أردني)</label>
              <input
                type="number"
                min="0"
                step="0.001"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-emerald-400/50"
                value={subAmount}
                onChange={e => setSubAmount(e.target.value)}
              />
            </div>

            {/* Payment method */}
            <div className="mb-4">
              <label className="text-xs text-slate-500 mb-2 block">طريقة الدفع</label>
              <div className="flex gap-2">
                {Object.entries(METHOD_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSubMethod(key)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all
                      ${subMethod === key
                        ? 'bg-sky-500/20 border border-sky-500 text-sky-300'
                        : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-500'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment reference */}
            <div className="mb-4">
              <label className="text-xs text-slate-500 mb-1 block">
                رقم الإيصال / المرجع <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-emerald-400/50"
                placeholder="مثال: REC-20260509-001"
                value={subRef}
                onChange={e => setSubRef(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="mb-5">
              <label className="text-xs text-slate-500 mb-1 block">ملاحظات (اختياري)</label>
              <input
                type="text"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-emerald-400/50"
                placeholder="أي ملاحظات إضافية..."
                value={subNotes}
                onChange={e => setSubNotes(e.target.value)}
              />
            </div>

            {/* Summary */}
            <div className="bg-slate-800/60 rounded-xl px-4 py-3 mb-5 text-xs text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-300 font-semibold">
                  {SUB_LABELS[subTier]} × {subMonths === 1 ? 'شهر' : subMonths === 12 ? 'سنة' : `${subMonths} أشهر`}
                </span>
                <span className="text-emerald-400 font-bold">{parseFloat(subAmount) || 0} JOD</span>
              </div>
              <div className="flex justify-between">
                <span>رصيد جديد:</span>
                <span className="text-violet-400">{subTier === 'premium' ? 'غير محدود' : SUB_CREDITS[subTier]}</span>
              </div>
            </div>

            <div className="flex gap-3 flex-row-reverse">
              <button
                onClick={run}
                disabled={loading || !subRef.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-40 transition-all"
              >
                {loading ? '...' : 'تفعيل الاشتراك'}
              </button>
              <button
                onClick={() => setModal(null)}
                className="px-5 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-slate-800 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={modal === 'unsuspend'}
        title="رفع إيقاف المزود"
        description={`هل تريد إعادة تفعيل مزود الخدمة "${name}"؟`}
        confirmLabel="رفع الإيقاف"
        loading={loading}
        onConfirm={run}
        onCancel={() => setModal(null)}
      />
      <ConfirmModal
        open={modal === 'verify'}
        title="منح شارة التوثيق"
        description={`سيظهر "${name}" كمزود موثّق لجميع العملاء.`}
        confirmLabel="منح التوثيق"
        loading={loading}
        onConfirm={run}
        onCancel={() => setModal(null)}
      />
      <ConfirmModal
        open={modal === 'unverify'}
        title="سحب شارة التوثيق"
        description={`سيُزال توثيق "${name}". هل أنت متأكد؟`}
        confirmLabel="سحب التوثيق"
        danger
        loading={loading}
        onConfirm={run}
        onCancel={() => setModal(null)}
      />
    </div>
  );
}
