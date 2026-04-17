'use client';

import { useState } from 'react';
import { ConfirmModal } from '../ui/confirm-modal';
import { disableUser, enableUser } from './actions';

interface UserActionsProps {
  userId:      string;
  userName:    string;
  isDisabled:  boolean;
}

export function UserActions({ userId, userName, isDisabled }: UserActionsProps) {
  const [showDisable, setShowDisable] = useState(false);
  const [showEnable,  setShowEnable]  = useState(false);
  const [reason,      setReason]      = useState('');
  const [loading,     setLoading]     = useState(false);

  async function handleDisable() {
    if (!reason.trim()) return;
    setLoading(true);
    await disableUser(userId, userName, reason.trim());
    setLoading(false);
    setShowDisable(false);
    setReason('');
  }

  async function handleEnable() {
    setLoading(true);
    await enableUser(userId, userName);
    setLoading(false);
    setShowEnable(false);
  }

  return (
    <>
      {isDisabled ? (
        <button
          onClick={() => setShowEnable(true)}
          className="text-xs px-3 py-1.5 rounded-lg bg-emerald-900/50 text-emerald-400 hover:bg-emerald-800/60 transition-colors font-semibold"
        >
          تفعيل
        </button>
      ) : (
        <button
          onClick={() => setShowDisable(true)}
          className="text-xs px-3 py-1.5 rounded-lg bg-red-900/40 text-red-400 hover:bg-red-800/50 transition-colors font-semibold"
        >
          تعطيل
        </button>
      )}

      {/* Disable modal — needs a reason */}
      {showDisable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm mx-4 text-right shadow-2xl">
            <h3 className="text-lg font-bold text-slate-100 mb-1">تعطيل الحساب</h3>
            <p className="text-sm text-slate-400 mb-4">{userName}</p>
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 resize-none outline-none focus:border-amber-400/50 mb-4"
              rows={3}
              placeholder="سبب التعطيل (مطلوب)..."
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
            <div className="flex gap-3 flex-row-reverse">
              <button
                onClick={handleDisable}
                disabled={loading || !reason.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-red-500 hover:bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {loading ? '...' : 'تعطيل'}
              </button>
              <button
                onClick={() => { setShowDisable(false); setReason(''); }}
                className="px-5 py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enable modal */}
      <ConfirmModal
        open={showEnable}
        title="تفعيل الحساب"
        description={`هل تريد إعادة تفعيل حساب ${userName}؟`}
        confirmLabel="تفعيل"
        loading={loading}
        onConfirm={handleEnable}
        onCancel={() => setShowEnable(false)}
      />
    </>
  );
}
