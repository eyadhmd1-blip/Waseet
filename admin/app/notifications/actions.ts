'use server';

import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { revalidatePath } from 'next/cache';

export async function sendBroadcast(params: {
  title:    string;
  body:     string;
  segment:  'all' | 'clients' | 'providers' | 'subscribed_providers';
  city?:    string;
}) {
  const { title, body, segment, city } = params;

  // Build target user query
  let query = supabaseAdmin.from('users').select('id');

  if (segment === 'clients') {
    query = query.eq('role', 'client');
  } else if (segment === 'providers') {
    query = query.eq('role', 'provider');
  } else if (segment === 'subscribed_providers') {
    // Get subscribed provider user IDs via join
    const { data: subProviders } = await supabaseAdmin
      .from('providers')
      .select('user_id')
      .eq('is_subscribed', true)
      .eq('is_active', true);

    const ids = (subProviders ?? []).map((p: any) => p.user_id);
    if (ids.length === 0) return { sent: 0 };

    // Insert notifications for each
    const rows = ids.map((uid: string) => ({
      user_id: uid,
      title,
      body,
      type: 'admin_broadcast',
    }));

    await supabaseAdmin.from('notifications').insert(rows);

    await logAudit({
      action:      'broadcast_notification',
      target_type: 'system',
      target_label: title,
      metadata: { segment, city: city ?? null, sent: ids.length },
    });

    revalidatePath('/notifications');
    return { sent: ids.length };
  }

  if (city) {
    query = query.eq('city', city);
  }

  const { data: users } = await query;
  const ids = (users ?? []).map((u: any) => u.id);
  if (ids.length === 0) return { sent: 0 };

  const rows = ids.map((uid: string) => ({
    user_id: uid,
    title,
    body,
    type: 'admin_broadcast',
  }));

  await supabaseAdmin.from('notifications').insert(rows);

  await logAudit({
    action:      'broadcast_notification',
    target_type: 'system',
    target_label: title,
    metadata: { segment, city: city ?? null, sent: ids.length },
  });

  revalidatePath('/notifications');
  return { sent: ids.length };
}
