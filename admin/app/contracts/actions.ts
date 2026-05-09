'use server';

import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { requireAdminSession } from '../lib/auth';
import { revalidatePath } from 'next/cache';

export async function pauseContract(contractId: string, title: string) {
  const admin = await requireAdminSession();

  await supabaseAdmin
    .from('recurring_contracts')
    .update({ status: 'paused' })
    .eq('id', contractId);

  await logAudit({
    action:       'close_request',
    target_type:  'contract',
    target_id:    contractId,
    target_label: title,
    performed_by: admin,
    metadata:     { action: 'pause' },
  });

  revalidatePath('/contracts');
}

export async function resumeContract(contractId: string, title: string) {
  const admin = await requireAdminSession();

  await supabaseAdmin
    .from('recurring_contracts')
    .update({ status: 'active' })
    .eq('id', contractId);

  await logAudit({
    action:       'close_request',
    target_type:  'contract',
    target_id:    contractId,
    target_label: title,
    performed_by: admin,
    metadata:     { action: 'resume' },
  });

  revalidatePath('/contracts');
}

export async function closeContract(contractId: string, title: string) {
  const admin = await requireAdminSession();

  await supabaseAdmin
    .from('recurring_contracts')
    .update({ status: 'cancelled' })
    .eq('id', contractId);

  await logAudit({
    action:       'close_request',
    target_type:  'contract',
    target_id:    contractId,
    target_label: title,
    performed_by: admin,
    metadata:     { action: 'cancel' },
  });

  revalidatePath('/contracts');
}
