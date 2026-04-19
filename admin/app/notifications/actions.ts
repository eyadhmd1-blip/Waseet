'use server';

import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { revalidatePath } from 'next/cache';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_BATCH = 100;

async function sendExpoPush(
  title: string,
  body:  string,
  userIds: string[],
): Promise<{ tokenCount: number; expoErrors: string[] }> {
  if (userIds.length === 0) return { tokenCount: 0, expoErrors: [] };

  const { data: rows, error: dbErr } = await supabaseAdmin
    .from('push_tokens')
    .select('token')
    .in('user_id', userIds);

  if (dbErr) {
    console.error('[push] DB error fetching tokens:', dbErr.message);
    return { tokenCount: 0, expoErrors: [dbErr.message] };
  }

  const tokens = (rows ?? []).map((r: any) => r.token as string).filter(Boolean);
  console.log(`[push] Found ${tokens.length} tokens for ${userIds.length} users`);

  if (tokens.length === 0) return { tokenCount: 0, expoErrors: [] };

  const expoErrors: string[] = [];

  for (let i = 0; i < tokens.length; i += EXPO_PUSH_BATCH) {
    const batch = tokens.slice(i, i + EXPO_PUSH_BATCH).map(token => ({
      to:    token,
      title,
      body,
      sound: 'default',
      data:  { type: 'admin_broadcast' },
    }));

    try {
      const res  = await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body:    JSON.stringify(batch),
      });
      const json = await res.json() as { data?: { status: string; message?: string }[] };
      const batchErrors = (json.data ?? [])
        .filter(r => r.status === 'error')
        .map(r => r.message ?? 'unknown error');
      expoErrors.push(...batchErrors);
      console.log(`[push] Expo batch ${i / EXPO_PUSH_BATCH + 1}: sent ${batch.length}, errors: ${batchErrors.length}`);
    } catch (err: any) {
      console.error('[push] Expo fetch error:', err?.message);
      expoErrors.push(err?.message ?? 'fetch failed');
    }
  }

  return { tokenCount: tokens.length, expoErrors };
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
    if (segment === 'clients')   query = query.eq('role', 'client');
    if (segment === 'providers') query = query.eq('role', 'provider');
    if (city)                    query = query.eq('city', city);
    const { data: users } = await query;
    ids = (users ?? []).map((u: any) => u.id);
  }

  console.log(`[broadcast] segment=${segment} users=${ids.length}`);
  if (ids.length === 0) return { sent: 0, tokens: 0, errors: [] };

  // 1. Insert in-app notifications
  const rows = ids.map((uid: string) => ({ user_id: uid, title, body, type: 'admin_broadcast' }));
  await supabaseAdmin.from('notifications').insert(rows);

  // 2. Send device push notifications
  const { tokenCount, expoErrors } = await sendExpoPush(title, body, ids);

  await logAudit({
    action:       'broadcast_notification',
    target_type:  'system',
    target_label: title,
    metadata:     { segment, city: city ?? null, users: ids.length, tokens: tokenCount, errors: expoErrors.length },
  });

  revalidatePath('/notifications');
  return { sent: ids.length, tokens: tokenCount, errors: expoErrors };
}
