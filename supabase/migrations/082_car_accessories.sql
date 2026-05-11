-- ============================================================
-- Migration 082: Add car_accessories service category
-- ============================================================
-- Adds "إكسسوارات وزينة السيارات" under the car_services group.
-- Covers: window tinting, LED lighting, seat covers, dash cams,
-- audio systems, car wraps, and other installation services.
-- sort_order 51 — after water_services (48-50) globally,
-- last item within car_services group.
-- ============================================================

INSERT INTO service_categories (slug, name_ar, name_en, icon, group_slug, sort_order, is_active)
VALUES ('car_accessories', 'إكسسوارات وزينة السيارات', 'Car Accessories & Decor', 'car-mod', 'car_services', 51, true)
ON CONFLICT (slug) DO NOTHING;

-- ─── Demo request template for car_accessories ───────────────

INSERT INTO demo_requests (title, description, city, district, category_slug, is_urgent)
VALUES (
  'تركيب تلميح زجاجي وإضاءة LED داخلية للسيارة',
  'سيارة Toyota Camry 2022 — أريد تلميح الزجاج الأمامي والخلفي درجة 30%، مع تركيب إضاءة LED زرقاء داخل الباب.',
  'عمّان', 'شارع المدينة', 'car_accessories', false
)
ON CONFLICT DO NOTHING;
