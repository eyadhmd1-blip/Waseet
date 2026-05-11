-- ============================================================
-- Migration 080: Add gardening to service_categories
--
-- Slug existed in categories.ts (local fallback) but was missing
-- from the DB — not visible in the live app when DB fetch succeeds.
-- ============================================================

INSERT INTO service_categories
  (slug, name_ar, name_en, icon, group_slug, group_ar, group_en, sort_order)
VALUES
  ('gardening', 'تنسيق الحدائق والبستنة', 'Landscaping & Gardening', 'sprout', 'maintenance', 'صيانة المنازل', 'Home Maintenance', 15)

ON CONFLICT (slug) DO NOTHING;
