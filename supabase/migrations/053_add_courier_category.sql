-- Migration 053: Add courier/parcel delivery service category
-- Mirrors the entry added to constants/categories.ts in the courier feature PR.
-- Without this row the DB fetch in useCategories overwrites the hardcoded
-- fallback and the category disappears from the UI.

INSERT INTO service_categories
  (slug, name_ar, name_en, icon, group_slug, group_ar, group_en, sort_order, is_active)
VALUES
  ('courier', 'توصيل طرود وبضائع', 'Parcel & Goods Delivery',
   'package', 'cleaning', 'تنظيف ونقل', 'Cleaning & Moving', 17, true)
ON CONFLICT (slug) DO UPDATE
  SET name_ar     = EXCLUDED.name_ar,
      name_en     = EXCLUDED.name_en,
      icon        = EXCLUDED.icon,
      sort_order  = EXCLUDED.sort_order,
      is_active   = EXCLUDED.is_active;
