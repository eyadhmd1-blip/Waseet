'use server';

import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { revalidatePath } from 'next/cache';

const SETTING_TYPES: Record<string, 'number' | 'boolean' | 'percent'> = {
  urgent_premium_pct:             'percent',
  urgent_window_hours:            'number',
  max_bids_per_request:           'number',
  auto_close_days:                'number',
  loyalty_cashback_pct:           'percent',
  maintenance_mode:               'boolean',
  new_registrations_open:         'boolean',
  provider_verification_required: 'boolean',
};

function validateSettingValue(key: string, value: string): string | null {
  const type = SETTING_TYPES[key];
  if (!type) return null;
  if (type === 'boolean') {
    if (value !== 'true' && value !== 'false') return `${key}: القيمة يجب أن تكون true أو false`;
  }
  if (type === 'number' || type === 'percent') {
    const n = parseFloat(value);
    if (isNaN(n)) return `${key}: القيمة يجب أن تكون رقماً`;
    if (type === 'percent' && (n < 0 || n > 100)) return `${key}: النسبة يجب أن تكون بين 0 و100`;
    if (type === 'number' && n < 0) return `${key}: القيمة يجب أن تكون موجبة`;
  }
  return null;
}

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
  for (const u of updates) {
    const err = validateSettingValue(u.key, u.value);
    if (err) throw new Error(err);
  }
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
