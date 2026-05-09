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

async function insertNotification(userId: string, title: string, body: string, type: string, screen = 'home') {
  try {
    await supabaseAdmin.from('notifications').insert({ user_id: userId, title, body, type, screen, metadata: {} });
  } catch { /* non-blocking */ }
}

export async function updateReportStatus(
  reportId: string,
  newStatus: string,
  notes: string,
) {
  const admin = await requireAdminSession();

  await supabaseAdmin
    .from('reports')
    .update({
      status:      newStatus,
      admin_notes: notes.trim() || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', reportId);

  await logAudit({
    action:       'update_report_status',
    target_type:  'report',
    target_id:    reportId,
    target_label: newStatus,
    performed_by: admin,
    metadata:     { new_status: newStatus, notes: notes.trim() || null },
  });

  revalidatePath('/abuse-reports');
}

export async function suspendUser(userId: string, reason: string, userName?: string) {
  const admin = await requireAdminSession();

  await supabaseAdmin.rpc('suspend_user', {
    p_user_id: userId,
    p_reason:  reason.trim() || null,
  });

  await logAudit({
    action:       'suspend_user',
    target_type:  'user',
    target_id:    userId,
    target_label: userName ?? userId,
    reason:       reason.trim() || undefined,
    performed_by: admin,
  });

  const suspendBody = reason.trim() || 'تم تعليق حسابك — تواصل مع الدعم للمزيد من التفاصيل';
  await Promise.all([
    sendPushToUser(userId, '⚠️ تم تعليق حسابك', suspendBody),
    insertNotification(userId, '⚠️ تم تعليق حسابك', suspendBody, 'account_suspended'),
  ]);

  revalidatePath('/abuse-reports');
}

export async function unsuspendUser(userId: string, userName?: string) {
  const admin = await requireAdminSession();

  await supabaseAdmin.rpc('unsuspend_user', { p_user_id: userId });

  await logAudit({
    action:       'unsuspend_user',
    target_type:  'user',
    target_id:    userId,
    target_label: userName ?? userId,
    performed_by: admin,
  });

  const unsuspendBody = 'مرحباً بعودتك — يمكنك الآن استخدام التطبيق بشكل طبيعي';
  await Promise.all([
    sendPushToUser(userId, '✅ تم رفع التعليق عن حسابك', unsuspendBody),
    insertNotification(userId, '✅ تم رفع التعليق عن حسابك', unsuspendBody, 'account_unsuspended'),
  ]);

  revalidatePath('/abuse-reports');
}
