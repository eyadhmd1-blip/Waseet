'use server';

import { logAudit } from '../lib/audit';
import { revalidatePath } from 'next/cache';

export async function logCategoryToggle(id: string, newActive: boolean) {
  await logAudit({
    action:       'toggle_category',
    target_type:  'category',
    target_id:    id,
    target_label: id,
    metadata: { is_active: newActive },
  });
  revalidatePath('/categories');
}

export async function logCategoryAdd(slug: string, nameAr: string) {
  await logAudit({
    action:       'add_category',
    target_type:  'category',
    target_label: nameAr,
    metadata: { slug },
  });
  revalidatePath('/categories');
}
