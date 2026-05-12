'use client';

import { useState } from 'react';
import { resolveFlag } from './actions';

type Action = 'warned' | 'suspended' | 'cleared';

const ACTION_LABEL: Record<Action, string> = {
  warned:    'تحذير',
  suspended: 'إيقاف مؤقت',
  cleared:   'تبرئة',
};

const ACTION_STYLE: Record<Action, string> = {
  warned:    'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25',
  suspended: 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25',
  cleared:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25',
};

export function FlagActions({
  flagId,
  flagReason,
  providerName,
}: {
  flagId:       string;
  flagReason:   string;
  providerName: string;
}) {
  const [open, setOpen]           = useState(false);
  const [action, setAction]       = useState<Action>('warned');
  const [note, setNote]           = useState('');
  const [loading, setLoading]     = useState(false);
  const [errorMsg, setErrorMsg]   = useState('');

  const handleSubmit = async () => {
    if (!note.trim()) { setErrorMsg('ملاحظة الإدارة مطلوبة'); return; }
    setLoading(true);
    setErrorMsg('');
    try {
      await resolveFlag(flagId, action, note, flagReason);
      setOpen(false);
      setNote('');
    } catch (e: any) {
      setErrorMsg(e.message === 'MISSING_NOTE' ? 'ملاحظة الإدارة مطلوبة' : 'حدث خطأ — حاول مجدداً');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-3 py-1.5 rounded-lg bg-amber-400/10 text-amber-400 border border-amber-500/30 hover:bg-amber-400/20 transition-colors"
      >
        اتخاذ قرار
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl" dir="rtl">
            <div>
              <h2 className="text-lg font-bold text-slate-100">قرار بخصوص البلاغ</h2>
              <p className="text-sm text-slate-500 mt-0.5">المزوّد: <span className="text-slate-300">{providerName}</span></p>
            </div>

            {/* Action selector */}
            <div className="flex gap-2">
              {(['warned', 'suspended', 'cleared'] as Action[]).map(a => (
                <button
                  key={a}
                  onClick={() => setAction(a)}
                  className={`flex-1 text-sm py-2 rounded-xl border font-medium transition-colors ${
                    action === a
                      ? ACTION_STYLE[a]
                      : 'bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  {ACTION_LABEL[a]}
                </button>
              ))}
            </div>

            {/* Admin note — required */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">ملاحظة الإدارة <span className="text-red-400">*</span></label>
              <textarea
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-200 text-sm resize-none placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                placeholder="أسباب القرار..."
                rows={3}
                value={note}
                onChange={e => setNote(e.target.value)}
                dir="rtl"
              />
              {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="text-sm px-4 py-2 rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className={`text-sm px-5 py-2 rounded-xl border font-semibold transition-colors disabled:opacity-50 ${ACTION_STYLE[action]}`}
              >
                {loading ? '...' : `تأكيد: ${ACTION_LABEL[action]}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
