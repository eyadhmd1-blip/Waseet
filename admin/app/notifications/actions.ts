'use server';

import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { revalidatePath } from 'next/cache';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_BATCH = 100; // Expo recommends max 100 per request

async function sendExpoPush(
  title: string,
  body:  string,
  userIds: string[],
): Promise<number> {
  if (userIds.length === 0) return 0;

  // Fetch all push tokens for these users
  const { data: rows } = await supabaseAdmin
    .from('push_tokens')
    .select('token')
    .in('user_id', userIds);

  const tokens = (rows ?? []).map((r: any) => r.token as string).filter(Boolean);
  if (tokens.length === 0) return 0;

  // Send in batches of 100
  for (let i = 0; i < tokens.length; i += EXPO_PUSH_BATCH) {
    const batch = tokens.slice(i, i + EXPO_PUSH_BATCH).map(token => ({
      to:    token,
      title,
      body,
      sound: 'default',
      data:  { type: 'admin_broadcast' },
    }));

    await fetch(EXPO_PUSH_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify(batch),
    });
  }

  return tokens.length;
}

export async function sendBroadcast(params: {
  title:    string;
  body:     string;
  segment:  'all' | 'clients' | 'providers' | 'subscribed_providers';
  city?:    string;
}) {
  const { title, body, segment, city } = params;

  let ids: string[] = [];

  if (segment === 'subscribed_providers') {
    const { data: subProviders } = await supabaseAdmin
      .from('providers')
      .select('user_id')
      .eq('is_subscribed', true)
      .eq('is_active', true);

    ids = (subProviders ?? []).map((p: any) => p.user_id);
  } else {
    let query = supabaseAdmin.from('users').select('id');

    if (segment === 'clients') {
      query = query.eq('role', 'client');
    } else if (segment === 'providers') {
      query = query.eq('role', 'provider');
    }

    if (city) {
      query = query.eq('city', city);
    }

    const { data: users } = await query;
    ids = (users ?? []).map((u: any) => u.id);
  }

  if (ids.length === 0) return { sent: 0 };

  // 1. Insert in-app notifications
  const rows = ids.map((uid: string) => ({
    user_id: uid,
    title,
    body,
    type: 'admin_broadcast',
  }));
  await supabaseAdmin.from('notifications').insert(rows);

  // 2. Send device push notifications via Expo
  await sendExpoPush(title, body, ids);

  await logAudit({
    action:       'broadcast_notification',
    target_type:  'system',
    target_label: title,
    metadata:     { segment, city: city ?? null, sent: ids.length },
  });

  revalidatePath('/notifications');
  return { sent: ids.length };
}
