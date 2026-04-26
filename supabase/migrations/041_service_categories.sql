-- ============================================================
-- Migration 041: Dynamic Service Categories
--
-- Creates service_categories table seeded from the hardcoded
-- CATEGORY_GROUPS constant in categories.ts.
-- The mobile app fetches from this table (with AsyncStorage cache
-- + hardcoded fallback), so admins can add/toggle categories
-- without a code deploy.
-- ============================================================

-- ── 1. Table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_categories (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  slug        TEXT         NOT NULL UNIQUE,
  name_ar     TEXT         NOT NULL,
  name_en     TEXT,
  icon        TEXT         NOT NULL DEFAULT 'wrench',
  group_slug  TEXT         NOT NULL,
  group_ar    TEXT         NOT NULL,
  group_en    TEXT,
  sort_order  INT          NOT NULL DEFAULT 0,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ── 2. RLS ────────────────────────────────────────────────────

ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;

-- Anyone can read active categories (no auth required)
CREATE POLICY "categories_public_read"
  ON service_categories FOR SELECT
  USING (is_active = true);

-- ── 3. Indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_service_categories_group
  ON service_categories (group_slug, sort_order)
  WHERE is_active = true;

-- ── 4. Seed data (mirrors categories.ts CATEGORY_GROUPS) ──────

INSERT INTO service_categories
  (slug, name_ar, name_en, icon, group_slug, group_ar, group_en, sort_order)
VALUES
  -- Group: maintenance
  ('electrical',       'كهرباء',              'Electrical',             'zap',          'maintenance', 'صيانة المنازل', 'Home Maintenance',            1),
  ('plumbing',         'سباكة',               'Plumbing',               'droplets',     'maintenance', 'صيانة المنازل', 'Home Maintenance',            2),
  ('ac_repair',        'تكييف وتبريد',         'AC & Cooling',           'wind',         'maintenance', 'صيانة المنازل', 'Home Maintenance',            3),
  ('carpentry',        'نجارة',               'Carpentry',              'hammer',       'maintenance', 'صيانة المنازل', 'Home Maintenance',            4),
  ('painting',         'دهان وديكور',          'Painting & Decor',       'paintbrush',   'maintenance', 'صيانة المنازل', 'Home Maintenance',            5),
  ('appliance_repair', 'إصلاح أجهزة منزلية',  'Appliance Repair',       'wrench',       'maintenance', 'صيانة المنازل', 'Home Maintenance',            6),
  ('tiling',           'بليط وأرضيات',         'Tiling & Flooring',      'tile',         'maintenance', 'صيانة المنازل', 'Home Maintenance',            7),
  ('plastering',       'قصارة وتشطيب',         'Plastering & Finishing', 'plaster',      'maintenance', 'صيانة المنازل', 'Home Maintenance',            8),
  ('ironwork',         'حدادة ولحام',           'Ironwork & Welding',     'iron',         'maintenance', 'صيانة المنازل', 'Home Maintenance',            9),
  ('aluminum',         'ألمنيوم',              'Aluminum Works',         'aluminium',    'maintenance', 'صيانة المنازل', 'Home Maintenance',            10),
  ('upholstery',       'تنجيد وإصلاح أثاث',   'Upholstery & Furniture', 'sofa',         'maintenance', 'صيانة المنازل', 'Home Maintenance',            11),
  ('gypsum',           'جبصين وديكور داخلي',  'Gypsum & Drywall',       'gypsum',       'maintenance', 'صيانة المنازل', 'Home Maintenance',            12),
  ('renovation',       'أعمال بناء وترميم',   'Renovation & Building',  'bricks',       'maintenance', 'صيانة المنازل', 'Home Maintenance',            13),
  ('glass',            'زجاج ومرايا',          'Glass & Mirrors',        'glass-pane',   'maintenance', 'صيانة المنازل', 'Home Maintenance',            14),

  -- Group: cleaning
  ('cleaning',         'تنظيف منزلي',          'Home Cleaning',          'sparkles',     'cleaning',    'تنظيف ونقل',   'Cleaning & Moving',           15),
  ('moving',           'نقل عفش وتوصيل',       'Moving & Delivery',      'truck',        'cleaning',    'تنظيف ونقل',   'Cleaning & Moving',           16),

  -- Group: technical
  ('networking',       'شبكات وإنترنت',         'Networks & Internet',    'wifi',         'technical',   'الخدمات الفنية', 'Technical Services',         17),
  ('cctv',             'كاميرات مراقبة',         'CCTV & Surveillance',    'cctv',         'technical',   'الخدمات الفنية', 'Technical Services',         18),
  ('solar',            'أنظمة الطاقة الشمسية', 'Solar Energy Systems',   'solar-panel',  'technical',   'الخدمات الفنية', 'Technical Services',         19),
  ('alarm_fire',       'إنذار وأنظمة حريق',    'Alarm & Fire Systems',   'fire-alarm',   'technical',   'الخدمات الفنية', 'Technical Services',         20),
  ('electronics',      'إلكترونيات وأجهزة',    'Electronics & Devices',  'desktop',      'technical',   'الخدمات الفنية', 'Technical Services',         21),
  ('computer_repair',  'صيانة حاسوب وطابعات',  'Computer & Printer Repair','laptop',     'technical',   'الخدمات الفنية', 'Technical Services',         22),

  -- Group: health_beauty
  ('cupping_massage',  'حجامة ومساج',           'Cupping & Massage',      'massage',      'health_beauty','الصحة والعناية', 'Health & Beauty',           23),
  ('home_nursing',     'تمريض وعناية منزلية',  'Home Nursing & Care',    'nurse',        'health_beauty','الصحة والعناية', 'Health & Beauty',           24),
  ('beauty_barber',    'حلاقة وتجميل منزلي',   'Home Beauty & Barber',   'haircut',      'health_beauty','الصحة والعناية', 'Health & Beauty',           25),

  -- Group: events
  ('photography',      'تصوير فوتوغرافي وفيديو','Photography & Video',   'photo',        'events',      'المناسبات والفعاليات', 'Events & Occasions',   26),
  ('pastry_cakes',     'حلويات وكيك مناسبات',  'Pastry & Cakes',         'cake',         'events',      'المناسبات والفعاليات', 'Events & Occasions',   27),
  ('event_decor',      'تنسيق وتزيين مناسبات', 'Event Decoration',       'party',        'events',      'المناسبات والفعاليات', 'Events & Occasions',   28),

  -- Group: education
  ('tutoring',         'تدريس خصوصي',          'Private Tutoring',       'book-open',    'education',   'تعليم وتدريب', 'Education & Training',        29),
  ('quran_teaching',   'تعليم قرآن وتجويد',    'Quran Teaching',         'moon',         'education',   'تعليم وتدريب', 'Education & Training',        30),

  -- Group: freelance
  ('design',           'تصميم جرافيك',          'Graphic Design',         'pen-tool',     'freelance',   'تصميم وأعمال حرة', 'Design & Freelance',      31),
  ('web_design',       'تصميم مواقع وتطبيقات', 'Web & App Design',       'code-bracket', 'freelance',   'تصميم وأعمال حرة', 'Design & Freelance',      32),
  ('digital_marketing','تسويق رقمي وسوشيال ميديا','Digital Marketing',   'chart-up',     'freelance',   'تصميم وأعمال حرة', 'Design & Freelance',      33),
  ('writing_translation','كتابة وترجمة',        'Writing & Translation',  'document',     'freelance',   'تصميم وأعمال حرة', 'Design & Freelance',      34),
  ('accounting',       'محاسبة وأعمال مالية',  'Accounting & Finance',   'calculator',   'freelance',   'تصميم وأعمال حرة', 'Design & Freelance',      35),

  -- Group: handicrafts
  ('tailoring',        'خياطة وتفصيل',          'Tailoring & Sewing',     'thread',       'handicrafts', 'الحِرَف اليدوية والتقليدية', 'Handicrafts & Traditions', 36),
  ('embroidery',       'تطريز وأعمال يدوية',   'Embroidery & Crafts',    'stitch',       'handicrafts', 'الحِرَف اليدوية والتقليدية', 'Handicrafts & Traditions', 37),
  ('shoemaking',       'صناعة وإصلاح أحذية',   'Shoemaking & Repair',    'shoe',         'handicrafts', 'الحِرَف اليدوية والتقليدية', 'Handicrafts & Traditions', 38),

  -- Group: pets
  ('pet_grooming',     'تجميل ورعاية الحيوانات','Pet Grooming & Care',   'paw',          'pets',        'الحيوانات الأليفة', 'Pet Services',             39),
  ('pet_training',     'تدريب الحيوانات',       'Pet Training',           'dog-lead',     'pets',        'الحيوانات الأليفة', 'Pet Services',             40),
  ('vet_home',         'بيطري منزلي',            'Home Vet Visit',         'stethoscope',  'pets',        'الحيوانات الأليفة', 'Pet Services',             41),

  -- Group: car_services
  ('car_repair',       'إصلاح السيارات',        'Car Repair',             'car',          'car_services','صيانة السيارات', 'Car Services',              42),
  ('car_electrical',   'كهرباء السيارات',       'Car Electrical',         'battery',      'car_services','صيانة السيارات', 'Car Services',              43),
  ('car_tires',        'إطارات وتغيير زيت',     'Tires & Oil Change',     'gauge',        'car_services','صيانة السيارات', 'Car Services',              44),
  ('car_ac',           'تكييف السيارات',        'Car AC & Cooling',       'snowflake',    'car_services','صيانة السيارات', 'Car Services',              45),
  ('car_bodywork',     'هيكل ودهان السيارات',   'Bodywork & Paint',       'shield',       'car_services','صيانة السيارات', 'Car Services',              46),
  ('car_cleaning',     'غسيل وتلميع السيارات',  'Car Wash & Detailing',   'droplet',      'car_services','صيانة السيارات', 'Car Services',              47)

ON CONFLICT (slug) DO NOTHING;
