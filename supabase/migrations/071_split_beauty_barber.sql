-- ============================================================
-- 071_split_beauty_barber.sql
-- Split 'beauty_barber' into two gender-specific categories:
--   beauty_women  →  تجميل نسائي منزلي
--   beauty_men    →  حلاقة رجالية منزلية
-- Old slug is deactivated (not deleted — existing requests keep it).
-- ============================================================

-- 1. Deactivate the old merged category
UPDATE service_categories
SET is_active = false
WHERE slug = 'beauty_barber';

-- 2. Insert women's beauty category
INSERT INTO service_categories
  (slug, name_ar, name_en, icon, group_slug, group_ar, group_en, sort_order, is_active)
VALUES
  ('beauty_women', 'تجميل نسائي منزلي', 'Women''s Home Beauty', 'lipstick', 'health_beauty', 'الصحة والعناية', 'Health & Beauty', 25, true)
ON CONFLICT (slug) DO UPDATE SET
  name_ar     = EXCLUDED.name_ar,
  name_en     = EXCLUDED.name_en,
  icon        = EXCLUDED.icon,
  sort_order  = EXCLUDED.sort_order,
  is_active   = EXCLUDED.is_active;

-- 3. Insert men's barber category
INSERT INTO service_categories
  (slug, name_ar, name_en, icon, group_slug, group_ar, group_en, sort_order, is_active)
VALUES
  ('beauty_men', 'حلاقة رجالية منزلية', 'Men''s Home Barber', 'scissors', 'health_beauty', 'الصحة والعناية', 'Health & Beauty', 26, true)
ON CONFLICT (slug) DO UPDATE SET
  name_ar     = EXCLUDED.name_ar,
  name_en     = EXCLUDED.name_en,
  icon        = EXCLUDED.icon,
  sort_order  = EXCLUDED.sort_order,
  is_active   = EXCLUDED.is_active;
