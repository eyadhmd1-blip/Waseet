'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── Report status actions ─────────────────────────────────────

export function ReportActions({
  reportId,
  currentStatus,
  reportedUserId,
  isSuspended,
  reportedName,
}: {
  reportId: string;
  currentStatus: string;
  reportedUserId?: string;
  isSuspended?: boolean;
  reportedName?: string;
}) {
  const [loading, setLoading]     = useState<string | null>(null);
  const [notes, setNotes]         = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const updateStatus = async (newStatus: string) => {
    setLoading(newStatus);
    await supabase
      .from('reports')
      .update({
        status:      newStatus,
        admin_notes: notes.trim() || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reportId);
    setLoading(null);
    window.location.reload();
  };

  return (
    <div className="space-y-2">
      {showNotes && (
        <textarea
          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-slate-200 text-sm resize-none text-right placeholder:text-slate-600"
          placeholder="أضف ملاحظة للإدارة (اختياري)..."
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          dir="rtl"
        />
      )}
      <div className="flex items-center gap-2 flex-wrap flex-row-reverse">
        <button
          onClick={() => setShowNotes(v => !v)}
          className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded"
        >
          {showNotes ? 'إخفاء الملاحظة' : '+ إضافة ملاحظة'}
        </button>
        {currentStatus === 'pending' && (
          <button
            onClick={() => updateStatus('reviewed')}
            disabled={!!loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/30 hover:bg-sky-500/25 transition-colors disabled:opacity-50"
          >
            {loading === 'reviewed' ? '...' : 'قيد المعالجة'}
          </button>
        )}
        <button
          onClick={() => updateStatus('resolved')}
          disabled={!!loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
        >
          {loading === 'resolved' ? '...' : 'تم الحل ✓'}
        </button>
        <button
          onClick={() => updateStatus('dismissed')}
          disabled={!!loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          {loading === 'dismissed' ? '...' : 'رفض البلاغ'}
        </button>

        {/* Inline suspend shortcut */}
        {reportedUserId && (
          <SuspendActions
            userId={reportedUserId}
            userName={reportedName ?? ''}
            isSuspended={isSuspended ?? false}
            compact
          />
        )}
      </div>
    </div>
  );
}

// ── Suspend / Unsuspend actions ───────────────────────────────

export function SuspendActions({
  userId,
  userName,
  isSuspended,
  compact = false,
}: {
  userId: string;
  userName: string;
  isSuspended: boolean;
  compact?: boolean;
}) {
  const [loading, setLoading]       = useState(false);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason]         = useState('');

  const suspend = async () => {
    if (!reason.trim() && !isSuspended) {
      setShowReason(true);
      return;
    }
    if (!window.confirm(
      isSuspended
        ? `رفع الإيقاف عن "${userName}"؟`
        : `إيقاف حساب "${userName}"؟ لا يمكنه تسجيل الدخول حتى ترفع الإيقاف.`
    )) return;

    setLoading(true);
    if (isSuspended) {
      await supabase.rpc('unsuspend_user', { p_user_id: userId });
    } else {
      await supabase.rpc('suspend_user', { p_user_id: userId, p_reason: reason.trim() || null });
    }
    setLoading(false);
    setShowReason(false);
    setReason('');
    window.location.reload();
  };

  if (compact) {
    return (
      <button
        onClick={suspend}
        disabled={loading}
        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
          isSuspended
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
            : 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25'
        }`}
      >
        {loading ? '...' : isSuspended ? 'رفع الإيقاف' : 'إيقاف الحساب'}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {showReason && !isSuspended && (
        <input
          autoFocus
          type="text"
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 text-xs text-right placeholder:text-slate-600 w-48"
          placeholder="سبب الإيقاف..."
          value={reason}
          onChange={e => setReason(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') suspend(); if (e.key === 'Escape') setShowReason(false); }}
          dir="rtl"
        />
      )}
      <button
        onClick={suspend}
        disabled={loading}
        className={`text-xs px-4 py-2 rounded-xl border font-medium transition-colors disabled:opacity-50 ${
          isSuspended
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
            : 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25'
        }`}
      >
        {loading ? '...' : isSuspended ? '✓ رفع الإيقاف' : '⛔ إيقاف الحساب'}
      </button>
    </div>
  );
}
