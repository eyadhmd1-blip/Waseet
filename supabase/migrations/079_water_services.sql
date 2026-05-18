-- ============================================================
-- Migration 079b: Water Services Category Group
--
-- Adds new group "water_services" (خدمات المياه) with 3 categories:
--   1. water_tank    — تنك مياه صالحة للشرب
--   2. sewage_tanker — صهريج مياه عادمة
--   3. tank_cleaning — تنظيف وتعقيم الخزانات
-- ============================================================

INSERT INTO service_categories
  (slug, name_ar, name_en, icon, group_slug, group_ar, group_en, sort_order)
VALUES
  ('water_tank',    'تنك مياه صالحة للشرب',    'Drinking Water Tank',     'water-tank',   'water_services', 'خدمات المياه', 'Water Services', 48),
  ('sewage_tanker', 'صهريج مياه عادمة',         'Sewage Tanker',           'sewage-truck', 'water_services', 'خدمات المياه', 'Water Services', 49),
  ('tank_cleaning', 'تنظيف وتعقيم الخزانات',   'Water Tank Cleaning',     'tank-wash',    'water_services', 'خدمات المياه', 'Water Services', 50)

ON CONFLICT (slug) DO NOTHING;
