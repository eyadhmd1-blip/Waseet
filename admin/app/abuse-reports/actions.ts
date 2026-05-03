'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '../lib/supabase';

export async function updateReportStatus(
  reportId: string,
  newStatus: string,
  notes: string,
) {
  await supabaseAdmin
    .from('reports')
    .update({
      status:      newStatus,
      admin_notes: notes.trim() || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', reportId);

  revalidatePath('/abuse-reports');
}

export async function suspendUser(userId: string, reason: string) {
  await supabaseAdmin.rpc('suspend_user', {
    p_user_id: userId,
    p_reason:  reason.trim() || null,
  });
  revalidatePath('/abuse-reports');
}

export async function unsuspendUser(userId: string) {
  await supabaseAdmin.rpc('unsuspend_user', { p_user_id: userId });
  revalidatePath('/abuse-reports');
}
