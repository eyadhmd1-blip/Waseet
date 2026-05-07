import { supabaseAdmin } from '../lib/supabase';
import { CategoryLimitsForm } from './category-limits-form';

export const dynamic = 'force-dynamic';

async function getCategories() {
  const { data } = await supabaseAdmin
    .from('service_categories')
    .select('id, slug, name_ar, name_en, group_ar, min_bid, max_bid, is_active')
    .order('sort_order');
  return data ?? [];
}

export default async function CategoryLimitsPage() {
  const categories = await getCategories();

  // Group by group_ar
  const groups: Record<string, typeof categories> = {};
  for (const cat of categories) {
    if (!groups[cat.group_ar]) groups[cat.group_ar] = [];
    groups[cat.group_ar].push(cat);
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">حدود أسعار العروض</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          حدد الحد الأدنى والأقصى للعروض لكل فئة خدمة. اتركها فارغة لعدم التقييد.
        </p>
      </div>

      <div className="space-y-6">
        {Object.entries(groups).map(([groupName, cats]) => (
          <div key={groupName} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/30">
              <h2 className="text-slate-300 font-semibold text-sm">{groupName}</h2>
            </div>
            <div className="divide-y divide-slate-800">
              {cats.map(cat => (
                <CategoryLimitsForm
                  key={cat.id}
                  id={cat.id}
                  slug={cat.slug}
                  nameAr={cat.name_ar}
                  minBid={cat.min_bid}
                  maxBid={cat.max_bid}
                  isActive={cat.is_active}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
