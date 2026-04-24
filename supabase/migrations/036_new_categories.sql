-- ============================================================
-- 036 — Expanded service categories
--
-- Adds new subcategories to صيانة المنازل,
-- and five new groups: الخدمات الفنية، الصحة والعناية،
-- المناسبات والفعاليات، الحِرَف اليدوية، الحيوانات الأليفة.
-- Also adds new subcategories to تصميم وأعمال حرة.
-- Safe to re-run: ON CONFLICT (slug) DO NOTHING.
-- ============================================================

INSERT INTO service_categories
  (slug, name_ar, name_en, icon, group_slug, sort_order, is_active)
VALUES

  -- ── صيانة المنازل — جديد ───────────────────────────────
  ('tiling',           'بليط وأرضيات',         'Tiling & Flooring',          'tile',         'maintenance',   7,  true),
  ('plastering',       'قصارة وتشطيب',          'Plastering & Finishing',     'plaster',      'maintenance',   8,  true),
  ('ironwork',         'حدادة ولحام',             'Ironwork & Welding',         'iron',         'maintenance',   9,  true),
  ('aluminum',         'ألمنيوم',                'Aluminum Works',             'aluminium',    'maintenance',   10, true),
  ('upholstery',       'تنجيد وإصلاح أثاث',      'Upholstery & Furniture',     'sofa',         'maintenance',   11, true),
  ('gypsum',           'جبصين وديكور داخلي',     'Gypsum & Drywall',           'gypsum',       'maintenance',   12, true),
  ('renovation',       'أعمال بناء وترميم',      'Renovation & Building',      'bricks',       'maintenance',   13, true),
  ('glass',            'زجاج ومرايا',             'Glass & Mirrors',            'glass-pane',   'maintenance',   14, true),

  -- ── الخدمات الفنية — جديد ─────────────────────────────
  ('networking',       'شبكات وإنترنت',           'Networks & Internet',         'wifi',         'technical',     17, true),
  ('cctv',             'كاميرات مراقبة',           'CCTV & Surveillance',         'cctv',         'technical',     18, true),
  ('solar',            'أنظمة الطاقة الشمسية',    'Solar Energy Systems',       'solar-panel',  'technical',     19, true),
  ('alarm_fire',       'إنذار وأنظمة حريق',       'Alarm & Fire Systems',       'fire-alarm',   'technical',     20, true),
  ('electronics',      'إلكترونيات وأجهزة',       'Electronics & Devices',      'desktop',      'technical',     21, true),
  ('computer_repair',  'صيانة حاسوب وطابعات',     'Computer & Printer Repair',  'laptop',       'technical',     22, true),

  -- ── الصحة والعناية — جديد ────────────────────────────
  ('cupping_massage',  'حجامة ومساج',             'Cupping & Massage',          'massage',      'health_beauty', 23, true),
  ('home_nursing',     'تمريض وعناية منزلية',     'Home Nursing & Care',        'nurse',        'health_beauty', 24, true),
  ('beauty_barber',    'حلاقة وتجميل منزلي',      'Home Beauty & Barber',       'haircut',      'health_beauty', 25, true),

  -- ── المناسبات والفعاليات — جديد ──────────────────────
  ('photography',      'تصوير فوتوغرافي وفيديو',  'Photography & Video',        'photo',        'events',        26, true),
  ('pastry_cakes',     'حلويات وكيك مناسبات',      'Pastry & Cakes',             'cake',         'events',        27, true),
  ('event_decor',      'تنسيق وتزيين مناسبات',    'Event Decoration',           'party',        'events',        28, true),

  -- ── تصميم وأعمال حرة — جديد ──────────────────────────
  ('web_design',          'تصميم مواقع وتطبيقات',      'Web & App Design',       'code-bracket', 'freelance',     32, true),
  ('digital_marketing',   'تسويق رقمي وسوشيال ميديا', 'Digital Marketing',      'chart-up',     'freelance',     33, true),
  ('writing_translation', 'كتابة وترجمة',              'Writing & Translation',  'document',     'freelance',     34, true),
  ('accounting',          'محاسبة وأعمال مالية',       'Accounting & Finance',   'calculator',   'freelance',     35, true),

  -- ── الحِرَف اليدوية والتقليدية — جديد ───────────────
  ('tailoring',        'خياطة وتفصيل',            'Tailoring & Sewing',         'thread',       'handicrafts',   36, true),
  ('embroidery',       'تطريز وأعمال يدوية',       'Embroidery & Crafts',        'stitch',       'handicrafts',   37, true),
  ('shoemaking',       'صناعة وإصلاح أحذية',       'Shoemaking & Repair',        'shoe',         'handicrafts',   38, true),

  -- ── الحيوانات الأليفة — جديد ─────────────────────────
  ('pet_grooming',     'تجميل ورعاية الحيوانات',  'Pet Grooming & Care',        'paw',          'pets',          39, true),
  ('pet_training',     'تدريب الحيوانات',          'Pet Training',               'dog-lead',     'pets',          40, true),
  ('vet_home',         'بيطري منزلي',              'Home Vet Visit',             'stethoscope',  'pets',          41, true)

ON CONFLICT (slug) DO NOTHING;
