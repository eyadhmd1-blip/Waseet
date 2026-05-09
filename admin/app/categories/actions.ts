'use server';

import { supabaseAdmin } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { requireAdminSession } from '../lib/auth';
import { revalidatePath } from 'next/cache';

export async function toggleCategory(id: string, newActive: boolean) {
  await requireAdminSession();
  await supabaseAdmin.from('service_categories').update({ is_active: newActive }).eq('id', id);
  await logAudit({
    action:       'toggle_category',
    target_type:  'category',
    target_id:    id,
    target_label: id,
    metadata: { is_active: newActive },
  });
  revalidatePath('/categories');
}

export async function addCategory(data: {
  slug: string; name_ar: string; name_en: string | null;
  icon: string; group_slug: string; group_ar: string; sort_order: number;
}) {
  await requireAdminSession();
  const { error } = await supabaseAdmin.from('service_categories').insert(data);
  if (error) return { error: error.message };
  await logAudit({
    action:       'add_category',
    target_type:  'category',
    target_label: data.name_ar,
    metadata: { slug: data.slug },
  });
  revalidatePath('/categories');
  return {};
}
