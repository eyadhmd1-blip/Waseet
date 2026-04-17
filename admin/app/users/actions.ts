'use server';

import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { revalidatePath } from 'next/cache';

export async function disableUser(userId: string, userName: string, reason: string) {
  await supabaseAdmin
    .from('users')
    .update({ is_disabled: true, disabled_at: new Date().toISOString(), disabled_reason: reason })
    .eq('id', userId);

  await logAudit({
    action: 'disable_user',
    target_type: 'user',
    target_id: userId,
    target_label: userName,
    reason,
  });

  revalidatePath('/users');
}

export async function enableUser(userId: string, userName: string) {
  await supabaseAdmin
    .from('users')
    .update({ is_disabled: false, disabled_at: null, disabled_reason: null })
    .eq('id', userId);

  await logAudit({
    action: 'enable_user',
    target_type: 'user',
    target_id: userId,
    target_label: userName,
  });

  revalidatePath('/users');
}
