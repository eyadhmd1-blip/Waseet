'use server';

import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { revalidatePath } from 'next/cache';

export async function updateSetting(key: string, value: string, label: string) {
  await supabaseAdmin
    .from('platform_settings')
    .upsert({ key, value, label, updated_at: new Date().toISOString() }, { onConflict: 'key' });

  await logAudit({
    action:      'update_setting',
    target_type: 'system',
    target_label: label,
    metadata: { key, value },
  });

  revalidatePath('/settings');
}

export async function updateSettings(updates: Array<{ key: string; value: string; label: string }>) {
  const rows = updates.map(u => ({ key: u.key, value: u.value, label: u.label, updated_at: new Date().toISOString() }));

  await supabaseAdmin
    .from('platform_settings')
    .upsert(rows, { onConflict: 'key' });

  await logAudit({
    action:      'update_setting',
    target_type: 'system',
    target_label: 'batch update',
    metadata: { keys: updates.map(u => u.key) },
  });

  revalidatePath('/settings');
}
