'use server';

import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { revalidatePath } from 'next/cache';

export async function replyToTicket(ticketId: string, body: string) {
  await supabaseAdmin.from('support_messages').insert({
    ticket_id: ticketId,
    sender_id: null,       // system/admin sender
    is_admin:  true,
    body,
  });

  await supabaseAdmin
    .from('support_tickets')
    .update({ status: 'in_review' })
    .eq('id', ticketId)
    .eq('status', 'open');  // only move open → in_review, not resolved

  revalidatePath('/support');
  revalidatePath(`/support/${ticketId}`);
}

export async function resolveTicket(ticketId: string, subject: string) {
  await supabaseAdmin
    .from('support_tickets')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', ticketId);

  await logAudit({
    action:       'close_request',   // reuse closest existing action type
    target_type:  'system',
    target_id:    ticketId,
    target_label: subject,
    metadata: { type: 'support_ticket_resolved' },
  });

  revalidatePath('/support');
  revalidatePath(`/support/${ticketId}`);
}

export async function assignTicket(ticketId: string, adminUserId: string) {
  await supabaseAdmin
    .from('support_tickets')
    .update({ assigned_to: adminUserId, status: 'in_review' })
    .eq('id', ticketId);

  revalidatePath('/support');
}
