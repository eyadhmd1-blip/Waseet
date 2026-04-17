'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export function ReportActions({
  reportId,
  currentStatus,
}: {
  reportId: string;
  currentStatus: string;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [notes, setNotes]     = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const updateStatus = async (newStatus: string) => {
    setLoading(newStatus);
    await supabase
      .from('reports')
      .update({
        status: newStatus,
        admin_notes: notes.trim() || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reportId);
    setLoading(null);
    // Refresh page
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
      <div className="flex items-center gap-2 flex-row-reverse">
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
      </div>
    </div>
  );
}
