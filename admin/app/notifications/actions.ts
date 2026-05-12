'use server';

import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { requireAdminSession } from '../lib/auth';
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

// ── Segment types ──────────────────────────────────────────────

export type Segment =
  | 'all'
  | 'clients'
  | 'providers'
  | 'subscribed_providers'
  | 'lapsed_providers'
  | 'dormant_providers'
  | 'no_portfolio_providers'
  | 'new_providers'
  | 'new_clients'
  | 'inactive_users';

// ── Segment resolver ───────────────────────────────────────────

async function resolveSegmentIds(segment: Segment, city?: string): Promise<string[]> {
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

  // Apply optional city filter to a list of provider IDs via the users table
  async function applyCity(ids: string[]): Promise<string[]> {
    if (!ids.length || !city) return ids;
    const { data: u } = await supabaseAdmin
      .from('users').select('id').in('id', ids).eq('city', city);
    return (u ?? []).map((u: any) => u.id as string);
  }

  switch (segment) {

    case 'subscribed_providers': {
      const { data } = await supabaseAdmin.from('providers').select('id').eq('is_subscribed', true);
      return applyCity((data ?? []).map((p: any) => p.id as string));
    }

    case 'lapsed_providers': {
      // Subscription ended within the last 30 days — prime re-subscribe window
      const { data } = await supabaseAdmin.from('providers').select('id')
        .eq('is_subscribed', false)
        .gte('subscription_ends', daysAgo(30))
        .lt('subscription_ends', now.toISOString());
      return applyCity((data ?? []).map((p: any) => p.id as string));
    }

    case 'dormant_providers': {
      // Subscription ended 31–90 days ago — needs stronger incentive
      const { data } = await supabaseAdmin.from('providers').select('id')
        .eq('is_subscribed', false)
        .gte('subscription_ends', daysAgo(90))
        .lt('subscription_ends', daysAgo(30));
      return applyCity((data ?? []).map((p: any) => p.id as string));
    }

    case 'no_portfolio_providers': {
      // Active subscribers who have never uploaded portfolio work
      const { data: subProvs } = await supabaseAdmin
        .from('providers').select('id').eq('is_subscribed', true);
      const baseIds = await applyCity((subProvs ?? []).map((p: any) => p.id as string));
      if (!baseIds.length) return [];
      const { data: hasPortfolio } = await supabaseAdmin
        .from('portfolio_items')
        .select('provider_id')
        .in('provider_id', baseIds);
      const withSet = new Set((hasPortfolio ?? []).map((p: any) => p.provider_id as string));
      return baseIds.filter((id: string) => !withSet.has(id));
    }

    case 'new_providers': {
      let q = supabaseAdmin.from('users').select('id')
        .eq('role', 'provider')
        .gte('created_at', daysAgo(7));
      if (city) q = q.eq('city', city);
      const { data } = await q;
      return (data ?? []).map((u: any) => u.id as string);
    }

    case 'new_clients': {
      let q = supabaseAdmin.from('users').select('id')
        .eq('role', 'client')
        .gte('created_at', daysAgo(7));
      if (city) q = q.eq('city', city);
      const { data } = await q;
      return (data ?? []).map((u: any) => u.id as string);
    }

    case 'inactive_users': {
      // Users inactive for 21+ days (last_seen_at or created_at as fallback)
      const cutoff = daysAgo(21);

      let q1 = supabaseAdmin.from('users').select('id')
        .in('role', ['client', 'provider'] as any)
        .is('last_seen_at', null)
        .lt('created_at', cutoff);
      if (city) q1 = q1.eq('city', city);

      let q2 = supabaseAdmin.from('users').select('id')
        .in('role', ['client', 'provider'] as any)
        .not('last_seen_at', 'is', null)
        .lt('last_seen_at', cutoff);
      if (city) q2 = q2.eq('city', city);

      const [r1, r2] = await Promise.all([q1, q2]);
      return [
        ...(r1.data ?? []).map((u: any) => u.id as string),
        ...(r2.data ?? []).map((u: any) => u.id as string),
      ];
    }

    default: {
      // 'all' | 'clients' | 'providers'
      let q = supabaseAdmin.from('users').select('id');
      if (segment === 'clients')   q = q.eq('role', 'client');
      if (segment === 'providers') q = q.eq('role', 'provider');
      if (city)                    q = q.eq('city', city);
      const { data } = await q;
      return (data ?? []).map((u: any) => u.id as string);
    }
  }
}

// ── estimateAudience ───────────────────────────────────────────

export async function estimateAudience(params: {
  segment: Segment;
  city?: string;
}): Promise<{ count: number }> {
  await requireAdminSession();
  const ids = await resolveSegmentIds(params.segment, params.city);
  return { count: ids.length };
}

// ── sendBroadcast ──────────────────────────────────────────────

export async function sendBroadcast(params: {
  title:   string;
  body:    string;
  segment: Segment;
  city?:   string;
}) {
  await requireAdminSession();

  const { title, body, segment, city } = params;
  const ids = await resolveSegmentIds(segment, city);

  console.log(`[broadcast] segment=${segment} city=${city ?? 'all'} users=${ids.length}`);
  if (ids.length === 0) return { sent: 0, tokens: 0, errors: [] };

  const rows = ids.map(uid => ({ user_id: uid, title, body, type: 'admin_broadcast' }));
  await supabaseAdmin.from('notifications').insert(rows);

  const { tokenCount, expoErrors } = await sendExpoPush(title, body, ids);

  await logAudit({
    action:       'broadcast_notification',
    target_type:  'system',
    target_label: title,
    metadata:     { segment, city: city ?? null, sent: ids.length, tokens: tokenCount, errors: expoErrors.length },
  });

  revalidatePath('/notifications');
  return { sent: ids.length, tokens: tokenCount, errors: expoErrors };
}
