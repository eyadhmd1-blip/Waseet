'use client';

import { useState } from 'react';
import { closeRequest } from './actions';

interface RequestActionsProps {
  requestId: string;
  title:     string;
  status:    string;
}

export function RequestActions({ requestId, title, status }: RequestActionsProps) {
  const [modal,   setModal]   = useState(false);
  const [reason,  setReason]  = useState('');
  const [loading, setLoading] = useState(false);

  if (status === 'cancelled' || status === 'completed') {
    return <span className="text-slate-700 text-xs">—</span>;
  }

  async function handleClose() {
    if (!reason.trim()) return;
    setLoading(true);
    await closeRequest(requestId, title, reason.trim());
    setLoading(false);
    setModal(false);
    setReason('');
  }

  return (
    <>
      <button
        onClick={() => setModal(true)}
        className="text-xs px-3 py-1.5 rounded-lg bg-red-900/40 text-red-400 hover:bg-red-800/50 transition-colors font-semibold"
      >
        إغلاق
      </button>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm mx-4 text-right shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 mb-1">إغلاق الطلب</h3>
            <p className="text-sm text-slate-400 mb-1 truncate">{title}</p>
            <p className="text-xs text-slate-600 mb-4">سيتم تغيير الحالة إلى "ملغي"</p>
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 resize-none outline-none focus:border-amber-400/50 mb-4"
              rows={3} placeholder="سبب الإغلاق (مطلوب)..."
              value={reason} onChange={e => setReason(e.target.value)}
            />
            <div className="flex gap-3 flex-row-reverse">
              <button onClick={handleClose} disabled={loading || !reason.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-red-500 hover:bg-red-600 text-white disabled:opacity-40 transition-all">
                {loading ? '...' : 'إغلاق الطلب'}
              </button>
              <button onClick={() => { setModal(false); setReason(''); }}
                className="px-5 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-slate-800 transition-all">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
