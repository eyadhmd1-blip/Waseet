'use server';

import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { revalidatePath } from 'next/cache';

export async function suspendProvider(providerId: string, userId: string, name: string, reason: string) {
  await supabaseAdmin
    .from('providers')
    .update({ is_active: false, suspended_at: new Date().toISOString(), suspension_reason: reason })
    .eq('id', providerId);

  await logAudit({
    action: 'suspend_provider',
    target_type: 'provider',
    target_id: providerId,
    target_label: name,
    reason,
    metadata: { user_id: userId },
  });

  revalidatePath('/providers');
}

export async function unsuspendProvider(providerId: string, name: string) {
  await supabaseAdmin
    .from('providers')
    .update({ is_active: true, suspended_at: null, suspension_reason: null })
    .eq('id', providerId);

  await logAudit({
    action: 'unsuspend_provider',
    target_type: 'provider',
    target_id: providerId,
    target_label: name,
  });

  revalidatePath('/providers');
}

export async function verifyProvider(providerId: string, name: string) {
  await supabaseAdmin
    .from('providers')
    .update({ badge_verified: true })
    .eq('id', providerId);

  await logAudit({
    action: 'verify_provider',
    target_type: 'provider',
    target_id: providerId,
    target_label: name,
  });

  revalidatePath('/providers');
}

export async function unverifyProvider(providerId: string, name: string) {
  await supabaseAdmin
    .from('providers')
    .update({ badge_verified: false })
    .eq('id', providerId);

  await logAudit({
    action: 'unverify_provider',
    target_type: 'provider',
    target_id: providerId,
    target_label: name,
  });

  revalidatePath('/providers');
}

export async function adjustCredits(
  providerId: string,
  name: string,
  amount: number,
  reason: string,
) {
  const { data: provider } = await supabaseAdmin
    .from('providers')
    .select('bid_credits')
    .eq('id', providerId)
    .single();

  const current = (provider as any)?.bid_credits ?? 0;
  const updated = Math.max(0, current + amount);

  await supabaseAdmin
    .from('providers')
    .update({ bid_credits: updated })
    .eq('id', providerId);

  await logAudit({
    action: amount >= 0 ? 'add_credits' : 'deduct_credits',
    target_type: 'provider',
    target_id: providerId,
    target_label: name,
    reason,
    metadata: { before: current, after: updated, delta: amount },
  });

  revalidatePath('/providers');
}

export async function overrideTier(
  providerId: string,
  name: string,
  newTier: string,
  oldTier: string,
) {
  await supabaseAdmin
    .from('providers')
    .update({ reputation_tier: newTier })
    .eq('id', providerId);

  await logAudit({
    action: 'override_tier',
    target_type: 'provider',
    target_id: providerId,
    target_label: name,
    metadata: { from: oldTier, to: newTier },
  });

  revalidatePath('/providers');
}
