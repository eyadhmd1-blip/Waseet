'use client';

import { useState } from 'react';
import { replyToTicket, resolveTicket } from './actions';

interface TicketReplyProps {
  ticketId: string;
  subject:  string;
  status:   string;
}

const CANNED = [
  { label: 'استلام التذكرة', body: 'شكراً لتواصلك مع فريق وسيط. استلمنا تذكرتك وسيقوم أحد أعضاء فريق الدعم بالرد خلال ٢–٤ ساعات.' },
  { label: 'طلب التحقق',     body: 'لمراجعة مشكلتك يرجى تزويدنا برقم الطلب وتاريخ الدفع وآخر ٤ أرقام من طريقة الدفع المستخدمة.' },
  { label: 'إغلاق الحل',    body: 'يسعدنا أن مشكلتك تم حلها. إذا واجهت أي استفسار آخر لا تتردد في فتح تذكرة جديدة. تقييمك يساعدنا على تحسين الخدمة!' },
];

export function TicketReply({ ticketId, subject, status }: TicketReplyProps) {
  const [body,     setBody]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [resolved, setResolved] = useState(status === 'resolved');

  async function handleSend() {
    if (!body.trim()) return;
    setLoading(true);
    await replyToTicket(ticketId, body.trim());
    setBody('');
    setLoading(false);
  }

  async function handleResolve() {
    setLoading(true);
    await resolveTicket(ticketId, subject);
    setResolved(true);
    setLoading(false);
  }

  if (resolved) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-right">
        <p className="text-emerald-400 font-semibold text-sm">✓ التذكرة محلولة</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={handleResolve}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 text-sm font-bold hover:bg-emerald-500/25 transition-colors disabled:opacity-40"
        >
          {loading ? '...' : 'تحديد كمحلولة ✓'}
        </button>
        <div className="text-slate-300 font-semibold text-sm">الرد على التذكرة</div>
      </div>

      {/* Canned responses */}
      <div className="flex gap-2 flex-wrap justify-end">
        {CANNED.map(c => (
          <button
            key={c.label}
            onClick={() => setBody(c.body)}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-amber-400 transition-colors border border-slate-700"
          >
            {c.label}
          </button>
        ))}
      </div>

      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={4}
        placeholder="اكتب ردك هنا..."
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 resize-none outline-none focus:border-amber-400/50 text-right"
      />
      <div className="flex justify-end">
        <button
          onClick={handleSend}
          disabled={loading || !body.trim()}
          className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm transition-colors disabled:opacity-40"
        >
          {loading ? 'جارٍ الإرسال...' : 'إرسال الرد'}
        </button>
      </div>
    </div>
  );
}
