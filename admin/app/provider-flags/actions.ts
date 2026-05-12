'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { requireAdminSession } from '../lib/auth';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendPushToUser(userId: string, title: string, body: string) {
  try {
    const { data: tokenRow } = await supabaseAdmin
      .from('push_tokens').select('token').eq('user_id', userId).maybeSingle();
    if (!tokenRow?.token) return;
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify([{ to: tokenRow.token, title, body, sound: 'default', priority: 'high', channelId: 'default' }]),
    });
  } catch { /* non-blocking */ }
}

async function insertNotification(userId: string, title: string, body: string, type: string) {
  try {
    await supabaseAdmin.from('notifications').insert({ user_id: userId, title, body, type, screen: 'home', metadata: {} });
  } catch { /* non-blocking */ }
}

export async function resolveFlag(
  flagId:    string,
  action:    'warned' | 'suspended' | 'cleared',
  adminNote: string,
  flagReason: string,
) {
  const admin = await requireAdminSession();
  if (!adminNote.trim()) throw new Error('MISSING_NOTE');

  // Call DB function — returns provider_id
  const { data: providerId, error } = await supabaseAdmin
    .rpc('resolve_provider_flag', {
      p_flag_id:    flagId,
      p_action:     action,
      p_admin_note: adminNote.trim(),
      p_admin_name: admin,
    });

  if (error) throw new Error(error.message);
  if (!providerId) throw new Error('FLAG_NOT_FOUND');

  // Apply side-effects for 'suspended'
  if (action === 'suspended') {
    await supabaseAdmin
      .from('providers')
      .update({ is_active: false, suspended_at: new Date().toISOString(), suspension_reason: adminNote.trim() })
      .eq('id', providerId);
  }

  // Notify provider for warned or suspended
  if (action === 'warned') {
    const body = 'تلقى حسابك تحذيراً من الإدارة — يرجى الاطلاع على التفاصيل';
    await Promise.all([
      sendPushToUser(providerId, '⚠️ تحذير من الإدارة', body),
      insertNotification(providerId, '⚠️ تحذير من الإدارة', body, 'account_warning'),
    ]);
  } else if (action === 'suspended') {
    const body = 'تم تعليق حسابك مؤقتاً — تواصل مع الدعم للمزيد من التفاصيل';
    await Promise.all([
      sendPushToUser(providerId, '⛔ تم تعليق حسابك', body),
      insertNotification(providerId, '⛔ تم تعليق حسابك', body, 'account_suspended'),
    ]);
  }

  await logAudit({
    action:       action === 'warned' ? 'warn_provider' : 'resolve_provider_flag',
    target_type:  'flag',
    target_id:    flagId,
    target_label: flagReason,
    reason:       adminNote.trim(),
    performed_by: admin,
    metadata:     { action, provider_id: providerId },
  });

  revalidatePath('/provider-flags');
}
