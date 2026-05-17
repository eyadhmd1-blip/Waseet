'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '../lib/supabase';
import { requireAdminSession } from '../lib/auth';

export async function markAlertRead(alertId: string) {
  await requireAdminSession();

  await supabaseAdmin
    .from('admin_alerts')
    .update({ is_read: true })
    .eq('id', alertId);

  revalidatePath('/cancellations');
}
