-- ============================================================
-- Migration 092: Rename electrical category for clarity
--
-- Changes name_ar from 'كهرباء' to 'كهرباء المنازل' and
-- name_en from 'Electrical' to 'Home Electrical' so the
-- home electrical category is unambiguous next to
-- 'كهرباء السيارات' (car_electrical).
--
-- Client cache is invalidated by bumping CACHE_KEY in
-- useCategories.ts from v1 to v2.
-- ============================================================

UPDATE service_categories
SET
  name_ar    = 'كهرباء المنازل',
  name_en    = 'Home Electrical'
WHERE slug = 'electrical';
