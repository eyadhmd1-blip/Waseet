'use server';

import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { getAdminUsername } from '../lib/session';
import { revalidatePath } from 'next/cache';

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

export async function disableUser(userId: string, userName: string, reason: string) {
  const admin = await getAdminUsername();

  await supabaseAdmin
    .from('users')
    .update({ is_disabled: true, disabled_at: new Date().toISOString(), disabled_reason: reason })
    .eq('id', userId);

  await logAudit({
    action:       'disable_user',
    target_type:  'user',
    target_id:    userId,
    target_label: userName,
    reason,
    performed_by: admin,
  });

  await sendPushToUser(
    userId,
    '⚠️ تم تعطيل حسابك',
    reason.trim() || 'تم تعطيل حسابك — تواصل مع الدعم للمزيد من التفاصيل',
  );

  revalidatePath('/users');
}

export async function enableUser(userId: string, userName: string) {
  const admin = await getAdminUsername();

  await supabaseAdmin
    .from('users')
    .update({ is_disabled: false, disabled_at: null, disabled_reason: null })
    .eq('id', userId);

  await logAudit({
    action:       'enable_user',
    target_type:  'user',
    target_id:    userId,
    target_label: userName,
    performed_by: admin,
  });

  await sendPushToUser(
    userId,
    '✅ تم تفعيل حسابك',
    'مرحباً بعودتك — يمكنك الآن استخدام التطبيق بشكل طبيعي',
  );

  revalidatePath('/users');
}
