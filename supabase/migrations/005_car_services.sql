-- ============================================================
-- WASEET — Car Services Category Group
-- v1.4 | April 2026
-- Adds صيانة السيارات (Car Services) as a new category group
-- ============================================================

INSERT INTO service_categories (slug, name_ar, name_en, group_slug, group_ar, group_en, icon, sort_order) VALUES
  ('car_repair',     'إصلاح السيارات',        'Car Repair',          'car_services', 'صيانة السيارات', 'Car Services', 'car',       12),
  ('car_electrical', 'كهرباء السيارات',       'Car Electrical',      'car_services', 'صيانة السيارات', 'Car Services', 'battery',   13),
  ('car_tires',      'إطارات وتغيير زيت',     'Tires & Oil Change',  'car_services', 'صيانة السيارات', 'Car Services', 'gauge',     14),
  ('car_ac',         'تكييف السيارات',        'Car AC & Cooling',    'car_services', 'صيانة السيارات', 'Car Services', 'snowflake', 15),
  ('car_bodywork',   'هيكل ودهان السيارات',   'Bodywork & Paint',    'car_services', 'صيانة السيارات', 'Car Services', 'shield',    16),
  ('car_cleaning',   'غسيل وتلميع السيارات',  'Car Wash & Detailing','car_services', 'صيانة السيارات', 'Car Services', 'droplet',   17);
