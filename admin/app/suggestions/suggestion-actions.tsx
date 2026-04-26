'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export function SuggestionActions({
  id,
  userId,
  serviceName,
}: {
  id:          string;
  userId:      string;
  serviceName: string;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [done,    setDone]    = useState(false);
  const [note,    setNote]    = useState('');

  const act = async (status: 'approved' | 'rejected') => {
    setLoading(status);

    await sb.from('service_suggestions').update({
      status,
      admin_note:  note.trim() || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: 'admin',
    }).eq('id', id);

    // On approval: send push notification if user has push tokens
    if (status === 'approved') {
      const { data: tokens } = await sb
        .from('push_tokens')
        .select('token')
        .eq('user_id', userId);

      if (tokens && tokens.length > 0) {
        await fetch(EXPO_PUSH_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(tokens.map((t: any) => ({
            to:       t.token,
            title:    '✅ تمت إضافة خدمتك!',
            body:     `تمت إضافة "${serviceName}" إلى قائمة الخدمات. يمكنك الآن طلبها أو تقديم عروض عليها.`,
            sound:    'default',
            priority: 'normal',
            data:     { screen: 'new_request' },
          }))),
        }).catch(() => {});
      }
    }

    setLoading(null);
    setDone(true);
  };

  if (done) {
    return <span className="text-xs text-slate-600">تمت المعالجة ✓</span>;
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="ملاحظة (اختياري)"
        className="w-48 text-xs bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-300 placeholder:text-slate-600 text-right"
        dir="rtl"
      />
      <div className="flex gap-2">
        <button
          onClick={() => act('rejected')}
          disabled={!!loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
        >
          {loading === 'rejected' ? '...' : 'رفض'}
        </button>
        <button
          onClick={() => act('approved')}
          disabled={!!loading}
          className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
        >
          {loading === 'approved' ? '...' : 'موافقة + إشعار ✓'}
        </button>
      </div>
    </div>
  );
}
