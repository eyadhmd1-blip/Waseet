'use client';

import { useState } from 'react';
import { ConfirmModal } from '../ui/confirm-modal';
import { suspendProvider, unsuspendProvider, verifyProvider, unverifyProvider, overrideTier } from './actions';

const TIERS = ['new', 'rising', 'trusted', 'expert', 'elite'] as const;
const TIER_LABELS: Record<string, string> = {
  new: 'جديد', rising: 'صاعد', trusted: 'موثوق', expert: 'خبير', elite: 'نخبة',
};

interface ProviderActionsProps {
  providerId:     string;
  userId:         string;
  name:           string;
  isActive:       boolean;
  badgeVerified:  boolean;
  currentTier:    string;
}

export function ProviderActions({
  providerId, userId, name, isActive, badgeVerified, currentTier
}: ProviderActionsProps) {
  const [open,        setOpen]        = useState(false);
  const [modal,       setModal]       = useState<'suspend' | 'unsuspend' | 'verify' | 'unverify' | 'tier' | null>(null);
  const [reason,      setReason]      = useState('');
  const [tier,        setTier]        = useState(currentTier);
  const [loading,     setLoading]     = useState(false);

  async function run() {
    setLoading(true);
    if (modal === 'suspend')   await suspendProvider(providerId, userId, name, reason);
    if (modal === 'unsuspend') await unsuspendProvider(providerId, name);
    if (modal === 'verify')    await verifyProvider(providerId, name);
    if (modal === 'unverify')  await unverifyProvider(providerId, name);
    if (modal === 'tier')      await overrideTier(providerId, name, tier, currentTier);
    setLoading(false);
    setModal(null);
    setOpen(false);
    setReason('');
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
