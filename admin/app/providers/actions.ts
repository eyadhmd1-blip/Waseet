'use server';

import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { revalidatePath } from 'next/cache';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendPushToUser(userId: string, title: string, body: string, data?: object) {
  const { data: tokenRow } = await supabaseAdmin
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId)
    .maybeSingle();
  if (!tokenRow?.token) return;
  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ to: tokenRow.token, title, body, sound: 'default', data: data ?? {} }),
  }).catch(() => {});
}

async function insertNotification(userId: string, title: string, body: string, type: string, screen = 'home') {
  try {
    await supabaseAdmin.from('notifications').insert({ user_id: userId, title, body, type, screen, metadata: {} });
  } catch { /* non-blocking */ }
}

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

  const suspendBody = 'تم تعليق حسابك مؤقتاً — تواصل مع الدعم للمزيد من التفاصيل';
  await Promise.all([
    sendPushToUser(userId, '⚠️ تم تعليق حسابك', suspendBody, { screen: 'home' }),
    insertNotification(userId, '⚠️ تم تعليق حسابك', suspendBody, 'account_suspended'),
  ]);

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

  // providers.id = users.id — use it directly as the push target
  const { data: prov } = await supabaseAdmin
    .from('providers')
    .select('id')
    .eq('id', providerId)
    .maybeSingle();

  if ((prov as any)?.id) {
    const unsuspendBody = 'مرحباً بعودتك — يمكنك الآن الاستمرار في استقبال الطلبات';
    await Promise.all([
      sendPushToUser((prov as any).id, '✅ تم رفع التعليق عن حسابك', unsuspendBody, { screen: 'home' }),
      insertNotification((prov as any).id, '✅ تم رفع التعليق عن حسابك', unsuspendBody, 'account_unsuspended'),
    ]);
  }

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
    .select('subscription_credits, bonus_credits, id')
    .eq('id', providerId)
    .single();

  // Combined current balance (matches what the admin UI shows)
  const currentSub   = (provider as any)?.subscription_credits ?? 0;
  const currentBonus = (provider as any)?.bonus_credits ?? 0;
  const current      = currentSub + currentBonus;
  // New total after delta
  const updated      = Math.max(0, current + amount);
  // Keep bonus separate; only subscription_credits absorbs the change
  const newSub       = Math.max(0, updated - currentBonus);

  await supabaseAdmin
    .from('providers')
    .update({ subscription_credits: newSub })
    .eq('id', providerId);

  await logAudit({
    action: amount >= 0 ? 'add_credits' : 'deduct_credits',
    target_type: 'provider',
    target_id: providerId,
    target_label: name,
    reason,
    metadata: { before: current, after: updated, delta: amount },
  });

  if ((provider as any)?.id) {
    const isAdd       = amount >= 0;
    const creditTitle = isAdd ? '💳 تمت إضافة رصيد إلى حسابك' : '💳 تم خصم رصيد من حسابك';
    // `updated` = combined total, matching what the admin preview showed
    const creditBody  = isAdd
      ? `تمت إضافة ${amount} رصيد — رصيدك الحالي: ${updated}`
      : `تم خصم ${Math.abs(amount)} رصيد — رصيدك الحالي: ${updated}`;
    await Promise.all([
      sendPushToUser((provider as any).id, creditTitle, creditBody, { screen: 'home' }),
      insertNotification((provider as any).id, creditTitle, creditBody, isAdd ? 'credits_added' : 'credits_deducted', 'subscribe'),
    ]);
  }

  revalidatePath('/providers');
}

export async function overrideTier(
  providerId: string,
  name: string,
  newTier: string,
  oldTier: string,
) {
  // tier_locked = true prevents update_provider_score() trigger from
  // auto-resetting this tier when the provider completes future jobs.
  await supabaseAdmin
    .from('providers')
    .update({ reputation_tier: newTier, tier_locked: true })
    .eq('id', providerId);

  await logAudit({
    action: 'override_tier',
    target_type: 'provider',
    target_id: providerId,
    target_label: name,
    metadata: { from: oldTier, to: newTier, locked: true },
  });

  revalidatePath('/providers');
}

export async function unlockTier(providerId: string, name: string) {
  await supabaseAdmin
    .from('providers')
    .update({ tier_locked: false })
    .eq('id', providerId);

  await logAudit({
    action: 'unlock_tier',
    target_type: 'provider',
    target_id: providerId,
    target_label: name,
    metadata: { locked: false },
  });

  revalidatePath('/providers');
}

const TIER_AR: Record<string, string> = {
  trial: 'تجريبية', basic: 'أساسية', pro: 'محترف', premium: 'نخبة',
};

export async function manualActivateSubscription(
  providerId: string,
  name: string,
  tier: string,
  periodMonths: number,
  amountJod: number,
  paymentMethod: string,
  paymentRef: string,
  notes: string,
) {
  // Block trial re-activation
  if (tier === 'trial') {
    const { data: prov } = await supabaseAdmin
      .from('providers')
      .select('trial_used')
      .eq('id', providerId)
      .single();
    if ((prov as any)?.trial_used) {
      throw new Error('TRIAL_ALREADY_USED');
    }
  }

  // Activate subscription (resets credits, trial_used, discounts)
  await supabaseAdmin.rpc('activate_provider_subscription', {
    p_provider_id:   providerId,
    p_tier:          tier,
    p_period_months: periodMonths,
  });

  // Audit trail — manual_payments table
  await supabaseAdmin.from('manual_payments').insert({
    provider_id:    providerId,
    tier,
    period_months:  periodMonths,
    amount_jod:     amountJod,
    payment_method: paymentMethod,
    payment_ref:    paymentRef,
    notes:          notes || null,
  });

  // Subscription history (same shape as Paddle webhook)
  const now = new Date();
  await supabaseAdmin.from('subscriptions').insert({
    provider_id:   providerId,
    tier,
    amount_paid:   amountJod,
    currency:      'JOD',
    discount_pct:  0,
    period_start:  now.toISOString(),
    period_end:    new Date(now.getTime() + periodMonths * 30 * 24 * 60 * 60 * 1000).toISOString(),
    paddle_txn_id: `manual_${paymentRef}`,
  });

  await logAudit({
    action: 'manual_activate_subscription',
    target_type: 'provider',
    target_id: providerId,
    target_label: name,
    metadata: { tier, period_months: periodMonths, amount_jod: amountJod, payment_method: paymentMethod, payment_ref: paymentRef },
  });

  const tierLabel = TIER_AR[tier] ?? tier;
  const notifBody = `تم تفعيل اشتراكك في الباقة ${tierLabel} لمدة ${periodMonths === 1 ? 'شهر' : `${periodMonths} أشهر`}`;
  await Promise.all([
    sendPushToUser(providerId, '🎉 تم تفعيل اشتراكك', notifBody, { screen: 'subscribe' }),
    insertNotification(providerId, '🎉 تم تفعيل اشتراكك', notifBody, 'subscription_activated', 'subscribe'),
  ]);

  revalidatePath('/providers');
}
