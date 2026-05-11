-- ============================================================
-- Migration 079: Add dry_cleaning and carpet_washing
--
-- These two services existed in categories.ts (local fallback)
-- but were missing from the service_categories DB table.
-- ============================================================

INSERT INTO service_categories
  (slug, name_ar, name_en, icon, group_slug, group_ar, group_en, sort_order)
VALUES
  ('dry_cleaning',   'دراي كلين',   'Dry Cleaning',    'shirt', 'cleaning', 'تنظيف ونقل', 'Cleaning & Moving', 18),
  ('carpet_washing', 'غسيل سجاد',   'Carpet Washing',  'broom', 'cleaning', 'تنظيف ونقل', 'Cleaning & Moving', 19)

ON CONFLICT (slug) DO NOTHING;
