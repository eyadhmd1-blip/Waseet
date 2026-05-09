'use server';

import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { requireAdminSession } from '../lib/auth';
import { revalidatePath } from 'next/cache';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendPushToUser(userId: string, title: string, body: string, data?: object) {
  try {
    const { data: tokenRow } = await supabaseAdmin
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId)
      .single();
    if (!tokenRow?.token) return;

    const res = await fetch(EXPO_PUSH_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify([{ to: tokenRow.token, title, body, sound: 'default', priority: 'high', channelId: 'default', data }]),
    });
    if (!res.ok) {
      console.error('[support-push] Expo push failed:', res.status, await res.text());
    }
  } catch (err: any) {
    console.error('[support-push] sendPushToUser error:', err?.message);
  }
}

export async function replyToTicket(ticketId: string, body: string) {
  if (!body?.trim()) throw new Error('Reply body cannot be empty');
  const admin = await requireAdminSession();

  await supabaseAdmin.from('support_messages').insert({
    ticket_id: ticketId,
    sender_id: null,
    is_admin:  true,
    body,
  });

  await supabaseAdmin
    .from('support_tickets')
    .update({ status: 'in_review' })
    .eq('id', ticketId)
    .eq('status', 'open');

  const { data: ticket } = await supabaseAdmin
    .from('support_tickets')
    .select('user_id, subject')
    .eq('id', ticketId)
    .single();

  await logAudit({
    action:       'reply_ticket',
    target_type:  'ticket',
    target_id:    ticketId,
    target_label: ticket?.subject ?? ticketId,
    performed_by: admin,
    metadata:     { preview: body.slice(0, 100) },
  });

  if (ticket?.user_id) {
    const notifBody = body.length > 80 ? body.slice(0, 80) + '…' : body;

    await Promise.all([
      sendPushToUser(
        ticket.user_id,
        'رد جديد على تذكرتك 💬',
        notifBody,
        { screen: 'support_thread', job_id: ticketId },
      ),
      supabaseAdmin.from('notifications').insert({
        user_id:  ticket.user_id,
        title:    'رد جديد على تذكرتك 💬',
        body:     notifBody,
        type:     'support_reply',
        screen:   'support_thread',
        metadata: { job_id: ticketId },
      }),
    ]);
  }

  revalidatePath('/support');
  revalidatePath(`/support/${ticketId}`);
}

export async function resolveTicket(ticketId: string, subject: string) {
  const admin = await requireAdminSession();

  await supabaseAdmin
    .from('support_tickets')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', ticketId);

  await logAudit({
    action:       'resolve_ticket',
    target_type:  'ticket',
    target_id:    ticketId,
    target_label: subject,
    performed_by: admin,
  });

  revalidatePath('/support');
  revalidatePath(`/support/${ticketId}`);
}

export async function assignTicket(ticketId: string, adminUserId: string) {
  const admin = await requireAdminSession();

  await supabaseAdmin
    .from('support_tickets')
    .update({ assigned_to: adminUserId, status: 'in_review' })
    .eq('id', ticketId);

  await logAudit({
    action:       'assign_ticket',
    target_type:  'ticket',
    target_id:    ticketId,
    target_label: adminUserId,
    performed_by: admin,
    metadata:     { assigned_to: adminUserId },
  });

  revalidatePath('/support');
}
