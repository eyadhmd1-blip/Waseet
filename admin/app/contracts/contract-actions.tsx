'use client';

import { useState } from 'react';
import { pauseContract, resumeContract, closeContract } from './actions';

interface ContractActionsProps {
  contractId: string;
  title:      string;
  status:     string;
}

export function ContractActions({ contractId, title, status }: ContractActionsProps) {
  const [closeModal, setCloseModal] = useState(false);
  const [loading,    setLoading]    = useState(false);

  if (status === 'cancelled' || status === 'completed') {
    return <span className="text-slate-700 text-xs">—</span>;
  }

  async function handlePause() {
    setLoading(true);
    await pauseContract(contractId, title);
    setLoading(false);
  }

  async function handleResume() {
    setLoading(true);
    await resumeContract(contractId, title);
    setLoading(false);
  }

  async function handleClose() {
    setLoading(true);
    await closeContract(contractId, title);
    setLoading(false);
    setCloseModal(false);
  }

  return (
    <>
      <div className="flex gap-2 items-center">
        {status === 'active' && (
          <button
            onClick={handlePause}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-amber-900/40 text-amber-400 hover:bg-amber-800/50 transition-colors font-medium disabled:opacity-40"
          >
            إيقاف
          </button>
        )}
        {status === 'paused' && (
          <button
            onClick={handleResume}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-900/40 text-emerald-400 hover:bg-emerald-800/50 transition-colors font-medium disabled:opacity-40"
          >
            استئناف
          </button>
        )}
        <button
          onClick={() => setCloseModal(true)}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-red-900/40 text-red-400 hover:bg-red-800/50 transition-colors font-medium disabled:opacity-40"
        >
          إنهاء
        </button>
      </div>

      {closeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm mx-4 text-right shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 mb-1">إنهاء العقد</h3>
            <p className="text-sm text-slate-400 mb-4 truncate">{title}</p>
            <p className="text-xs text-slate-500 mb-5">سيتم تغيير الحالة إلى "ملغي" ولا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-3 flex-row-reverse">
              <button
                onClick={handleClose}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-red-500 hover:bg-red-600 text-white disabled:opacity-40 transition-all"
              >
                {loading ? '...' : 'إنهاء العقد'}
              </button>
              <button
                onClick={() => setCloseModal(false)}
                className="px-5 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-slate-800 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
