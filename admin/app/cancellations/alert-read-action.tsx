'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export function AlertReadAction({ alertId }: { alertId: string }) {
  const [loading, setLoading] = useState(false);

  const markRead = async () => {
    setLoading(true);
    await supabase
      .from('admin_alerts')
      .update({ is_read: true })
      .eq('id', alertId);
    setLoading(false);
    window.location.reload();
  };

  return (
    <button
      onClick={markRead}
      disabled={loading}
      className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 transition-colors disabled:opacity-50"
    >
      {loading ? '...' : 'تم القراءة'}
    </button>
  );
}
