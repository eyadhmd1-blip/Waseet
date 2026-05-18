'use client';

import { useState } from 'react';
import { markAlertRead } from './actions';

export function AlertReadAction({ alertId }: { alertId: string }) {
  const [loading, setLoading] = useState(false);

  const markRead = async () => {
    setLoading(true);
    await markAlertRead(alertId);
    setLoading(false);
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
