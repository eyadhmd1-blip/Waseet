import { supabaseAdmin } from '../../lib/supabase';
import { Badge } from '../../ui/badge';
import { TicketReply } from '../ticket-reply';
import Link from 'next/link';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-JO', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const CAT_META: Record<string, { label: string; icon: string }> = {
  payment:  { label: 'مدفوعات',   icon: '💳' },
  order:    { label: 'طلبات',     icon: '📋' },
  provider: { label: 'مزود خدمة', icon: '🔧' },
  account:  { label: 'حساب',      icon: '👤' },
  contract: { label: 'عقد دوري',  icon: '📄' },
  other:    { label: 'أخرى',      icon: '💬' },
};

const STATUS_META: Record<string, { label: string; variant: 'info' | 'warning' | 'success' | 'muted' }> = {
  open:      { label: 'مفتوحة',       variant: 'info' },
  in_review: { label: 'قيد المراجعة', variant: 'warning' },
  resolved:  { label: 'محلولة',       variant: 'success' },
  closed:    { label: 'مغلقة',        variant: 'muted' },
};

async function getTicket(id: string) {
  const { data } = await supabaseAdmin
    .from('support_tickets')
    .select(`
      id, category, priority, status, subject, rating, rating_note,
      opened_at, resolved_at,
      user:users(id, full_name, phone, role, city)
    `)
    .eq('id', id)
    .single();
  return data;
}

async function getMessages(ticketId: string) {
  const { data } = await supabaseAdmin
    .from('support_messages')
    .select('id, sender_id, is_admin, body, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  return data ?? [];
}

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [ticket, messages] = await Promise.all([getTicket(id), getMessages(id)]);

  if (!ticket) {
    return (
      <div className="p-6">
        <p className="text-slate-500">التذكرة غير موجودة</p>
        <Link href="/support" className="text-amber-400 text-sm mt-2 inline-block">← العودة</Link>
      </div>
    );
  }

  const cat = CAT_META[ticket.category] ?? CAT_META.other;
  const st  = STATUS_META[ticket.status] ?? STATUS_META.open;
  const user = (ticket as any).user ?? {};

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* Header */}
      <div>
        <Link href="/support" className="text-slate-500 text-sm hover:text-amber-400 transition-colors">
          ← العودة للتذاكر
        </Link>
        <div className="flex items-start justify-between gap-4 mt-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-100">{ticket.subject}</h1>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Badge variant={st.variant}>{st.label}</Badge>
              <Badge variant={ticket.priority === 'urgent' ? 'danger' : 'muted'}>
                {ticket.priority === 'urgent' ? '🔴 طارئ' : '🔵 عادي'}
              </Badge>
              <span className="text-slate-500 text-xs self-center">{cat.icon} {cat.label}</span>
              <span className="text-slate-600 text-xs self-center font-mono">{ticket.id.slice(0,8).toUpperCase()}</span>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-right text-sm min-w-[180px]">
            <div className="text-slate-200 font-semibold">{user.full_name ?? '—'}</div>
            <div className="text-slate-500 text-xs mt-1">{user.role === 'provider' ? '🔧 مزود' : '👤 عميل'} · {user.city ?? '—'}</div>
            {user.phone && <div className="text-slate-600 text-xs mt-0.5 dir-ltr text-right">{user.phone}</div>}
          </div>
        </div>
        <div className="text-slate-600 text-xs mt-2">
          فُتحت: {fmtDate(ticket.opened_at)}
          {ticket.resolved_at && ` · حُلّت: ${fmtDate(ticket.resolved_at)}`}
        </div>
      </div>

      {/* Messages thread */}
      <div className="space-y-3">
        {messages.length === 0 && (
          <div className="text-slate-600 text-sm text-center py-8 bg-slate-900 border border-slate-800 rounded-2xl">
            لا توجد رسائل بعد
          </div>
        )}
        {messages.map((msg: any) => (
          <div
            key={msg.id}
            className={`flex ${msg.is_admin ? 'justify-start' : 'justify-end'}`}
          >
            <div className={`max-w-[75%] rounded-2xl p-4 text-sm ${
              msg.is_admin
                ? 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tr-sm'
                : 'bg-amber-500/15 border border-amber-500/25 text-slate-200 rounded-tl-sm'
            }`}>
              {msg.is_admin && (
                <div className="text-sky-400 text-xs font-semibold mb-1">
                  {msg.sender_id ? 'فريق الدعم 👩‍💼' : 'وسيط بوت 🤖'}
                </div>
              )}
              <p className="leading-relaxed text-right">{msg.body}</p>
              <div className={`text-xs mt-2 ${msg.is_admin ? 'text-slate-600 text-left' : 'text-amber-600/70 text-right'}`}>
                {fmtDate(msg.created_at)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Rating (if resolved) */}
      {ticket.status === 'resolved' && ticket.rating && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-right">
          <div className="text-slate-400 text-xs mb-1">تقييم المستخدم</div>
          <div className="text-amber-400">{'⭐'.repeat(ticket.rating)}</div>
          {ticket.rating_note && <p className="text-slate-400 text-sm mt-2">{ticket.rating_note}</p>}
        </div>
      )}

      {/* Reply form */}
      <TicketReply ticketId={ticket.id} subject={ticket.subject} status={ticket.status} />

    </div>
  );
}
