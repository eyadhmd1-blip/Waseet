import { supabaseAdmin } from '../lib/supabase';
import { ToggleCategory, AddCategoryForm } from './category-actions';

async function getCategories() {
  const { data } = await supabaseAdmin
    .from('service_categories')
    .select('*')
    .order('sort_order', { ascending: true });
  return data ?? [];
}

function groupBy<T>(arr: T[], key: keyof T): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of arr) {
    const k = String(item[key]);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}

export default async function CategoriesPage() {
  const categories = await getCategories();
  const grouped    = groupBy(categories, 'group_slug');
  const maxSort    = categories.reduce((m: number, c: any) => Math.max(m, c.sort_order ?? 0), 0);

  const active   = categories.filter((c: any) => c.is_active).length;
  const inactive = categories.length - active;

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap" dir="rtl">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">التصنيفات</h1>
          <p className="text-slate-500 text-sm mt-0.5">إدارة تصنيفات الخدمات المعروضة في التطبيق</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-right">
            <div className="text-lg font-bold text-amber-400">{active}</div>
            <div className="text-xs text-slate-600">نشط</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-right">
            <div className="text-lg font-bold text-slate-400">{inactive}</div>
            <div className="text-xs text-slate-600">مُخفى</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-right">
            <div className="text-lg font-bold text-slate-300">{categories.length}</div>
            <div className="text-xs text-slate-600">الإجمالي</div>
          </div>
        </div>
      </div>

      {/* Add category */}
      <div dir="rtl">
        <AddCategoryForm maxSort={maxSort} />
      </div>

      {/* Groups */}
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([groupSlug, cats]) => {
          const groupAr = (cats[0] as any).group_ar ?? groupSlug;
          const groupEn = (cats[0] as any).group_en ?? groupSlug;
          return (
            <div key={groupSlug} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">

              {/* Group header */}
              <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between" dir="rtl">
                <span className="text-slate-200 font-semibold">{groupAr}</span>
                <span className="text-slate-600 text-xs font-mono">{groupEn}</span>
              </div>

              {/* Category rows */}
              <div className="divide-y divide-slate-800">
                {cats.map((cat: any) => (
                  <div key={cat.id} className="px-5 py-3 flex items-center justify-between gap-4" dir="rtl">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${cat.is_active ? 'text-slate-200' : 'text-slate-500 line-through'}`}>
                        {cat.name_ar}
                      </p>
                      <p className="text-xs text-slate-600 font-mono mt-0.5">{cat.slug}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-xs text-slate-600 font-mono">{cat.icon}</span>
                      <span className="text-xs text-slate-700">#{cat.sort_order}</span>
                      <ToggleCategory id={cat.id} isActive={cat.is_active} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-slate-700 text-xs text-right" dir="rtl">
        تحديث الحالة يظهر للمستخدمين خلال ساعة (بعد انتهاء الـ cache).
      </p>
    </div>
  );
}
