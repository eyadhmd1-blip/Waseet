'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '../lib/supabase';
import { requireAdminSession } from '../lib/auth';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export async function reviewSuggestion(
  id: string,
  userId: string,
  serviceName: string,
  status: 'approved' | 'rejected',
  note: string,
) {
  await requireAdminSession();

  await supabaseAdmin.from('service_suggestions').update({
    status,
    admin_note:  note.trim() || null,
    reviewed_at: new Date().toISOString(),
    reviewed_by: 'admin',
  }).eq('id', id);

  if (status === 'approved') {
    const title = '✅ تمت إضافة خدمتك!';
    const body  = `تمت إضافة "${serviceName}" إلى قائمة الخدمات. يمكنك الآن طلبها أو تقديم عروض عليها.`;

    const { data: tokens } = await supabaseAdmin
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId);

    await Promise.all([
      tokens && tokens.length > 0
        ? fetch(EXPO_PUSH_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(tokens.map((t: any) => ({
              to: t.token, title, body,
              sound: 'default', priority: 'normal',
              data: { screen: 'new_request' },
            }))),
          }).catch(() => {})
        : Promise.resolve(),
      (async () => {
        try {
          await supabaseAdmin.from('notifications').insert({
            user_id:  userId,
            title,
            body,
            type:     'suggestion_approved',
            screen:   'new_request',
            metadata: { service_name: serviceName },
          });
        } catch { /* non-blocking */ }
      })(),
    ]);
  }

  revalidatePath('/suggestions');
}
