'use server';

import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { revalidatePath } from 'next/cache';

export async function closeRequest(requestId: string, title: string, reason: string) {
  await supabaseAdmin
    .from('requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId);

  await logAudit({
    action: 'close_request',
    target_type: 'request',
    target_id: requestId,
    target_label: title,
    reason,
  });

  revalidatePath('/requests');
}

export async function deleteRequest(requestId: string, title: string, reason: string) {
  // Soft-delete: just cancel (hard delete would cascade bids/jobs)
  await supabaseAdmin
    .from('requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId);

  await logAudit({
    action: 'delete_request',
    target_type: 'request',
    target_id: requestId,
    target_label: title,
    reason,
    metadata: { soft_delete: true },
  });

  revalidatePath('/requests');
}
