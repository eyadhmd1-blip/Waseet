-- ============================================================
-- 036 — Expanded service categories
-- ============================================================

INSERT INTO service_categories
  (slug, name_ar, name_en, icon, group_slug, group_ar, group_en, sort_order, is_active)
VALUES

  -- ── صيانة المنازل — جديد ───────────────────────────────
  ('tiling',           'بليط وأرضيات',          'Tiling & Flooring',          'tile',         'maintenance',   'صيانة المنازل', 'Home Maintenance',           7,  true),
  ('plastering',       'قصارة وتشطيب',           'Plastering & Finishing',     'plaster',      'maintenance',   'صيانة المنازل', 'Home Maintenance',           8,  true),
  ('ironwork',         'حدادة ولحام',              'Ironwork & Welding',         'iron',         'maintenance',   'صيانة المنازل', 'Home Maintenance',           9,  true),
  ('aluminum',         'ألمنيوم',                 'Aluminum Works',             'aluminium',    'maintenance',   'صيانة المنازل', 'Home Maintenance',           10, true),
  ('upholstery',       'تنجيد وإصلاح أثاث',       'Upholstery & Furniture',     'sofa',         'maintenance',   'صيانة المنازل', 'Home Maintenance',           11, true),
  ('gypsum',           'جبصين وديكور داخلي',      'Gypsum & Drywall',           'gypsum',       'maintenance',   'صيانة المنازل', 'Home Maintenance',           12, true),
  ('renovation',       'أعمال بناء وترميم',       'Renovation & Building',      'bricks',       'maintenance',   'صيانة المنازل', 'Home Maintenance',           13, true),
  ('glass',            'زجاج ومرايا',              'Glass & Mirrors',            'glass-pane',   'maintenance',   'صيانة المنازل', 'Home Maintenance',           14, true),

  -- ── الخدمات الفنية — جديد ─────────────────────────────
  ('networking',       'شبكات وإنترنت',            'Networks & Internet',        'wifi',         'technical',     'الخدمات الفنية', 'Technical Services',         17, true),
  ('cctv',             'كاميرات مراقبة',            'CCTV & Surveillance',        'cctv',         'technical',     'الخدمات الفنية', 'Technical Services',         18, true),
  ('solar',            'أنظمة الطاقة الشمسية',     'Solar Energy Systems',       'solar-panel',  'technical',     'الخدمات الفنية', 'Technical Services',         19, true),
  ('alarm_fire',       'إنذار وأنظمة حريق',        'Alarm & Fire Systems',       'fire-alarm',   'technical',     'الخدمات الفنية', 'Technical Services',         20, true),
  ('electronics',      'إلكترونيات وأجهزة',        'Electronics & Devices',      'desktop',      'technical',     'الخدمات الفنية', 'Technical Services',         21, true),
  ('computer_repair',  'صيانة حاسوب وطابعات',      'Computer & Printer Repair',  'laptop',       'technical',     'الخدمات الفنية', 'Technical Services',         22, true),

  -- ── الصحة والعناية — جديد ────────────────────────────
  ('cupping_massage',  'حجامة ومساج',              'Cupping & Massage',          'massage',      'health_beauty', 'الصحة والعناية', 'Health & Beauty',            23, true),
  ('home_nursing',     'تمريض وعناية منزلية',      'Home Nursing & Care',        'nurse',        'health_beauty', 'الصحة والعناية', 'Health & Beauty',            24, true),
  ('beauty_barber',    'حلاقة وتجميل منزلي',       'Home Beauty & Barber',       'haircut',      'health_beauty', 'الصحة والعناية', 'Health & Beauty',            25, true),

  -- ── المناسبات والفعاليات — جديد ──────────────────────
  ('photography',      'تصوير فوتوغرافي وفيديو',   'Photography & Video',        'photo',        'events',        'المناسبات والفعاليات', 'Events & Occasions',   26, true),
  ('pastry_cakes',     'حلويات وكيك مناسبات',       'Pastry & Cakes',             'cake',         'events',        'المناسبات والفعاليات', 'Events & Occasions',   27, true),
  ('event_decor',      'تنسيق وتزيين مناسبات',     'Event Decoration',           'party',        'events',        'المناسبات والفعاليات', 'Events & Occasions',   28, true),

  -- ── تصميم وأعمال حرة — جديد ──────────────────────────
  ('web_design',          'تصميم مواقع وتطبيقات',       'Web & App Design',       'code-bracket', 'freelance',     'تصميم وأعمال حرة', 'Design & Freelance',     32, true),
  ('digital_marketing',   'تسويق رقمي وسوشيال ميديا',  'Digital Marketing',      'chart-up',     'freelance',     'تصميم وأعمال حرة', 'Design & Freelance',     33, true),
  ('writing_translation', 'كتابة وترجمة',               'Writing & Translation',  'document',     'freelance',     'تصميم وأعمال حرة', 'Design & Freelance',     34, true),
  ('accounting',          'محاسبة وأعمال مالية',        'Accounting & Finance',   'calculator',   'freelance',     'تصميم وأعمال حرة', 'Design & Freelance',     35, true),

  -- ── الحِرَف اليدوية والتقليدية — جديد ───────────────
  ('tailoring',        'خياطة وتفصيل',             'Tailoring & Sewing',         'thread',       'handicrafts',   'الحِرَف اليدوية والتقليدية', 'Handicrafts & Traditions', 36, true),
  ('embroidery',       'تطريز وأعمال يدوية',        'Embroidery & Crafts',        'stitch',       'handicrafts',   'الحِرَف اليدوية والتقليدية', 'Handicrafts & Traditions', 37, true),
  ('shoemaking',       'صناعة وإصلاح أحذية',        'Shoemaking & Repair',        'shoe',         'handicrafts',   'الحِرَف اليدوية والتقليدية', 'Handicrafts & Traditions', 38, true),

  -- ── الحيوانات الأليفة — جديد ─────────────────────────
  ('pet_grooming',     'تجميل ورعاية الحيوانات',   'Pet Grooming & Care',        'paw',          'pets',          'الحيوانات الأليفة', 'Pet Services',             39, true),
  ('pet_training',     'تدريب الحيوانات',           'Pet Training',               'dog-lead',     'pets',          'الحيوانات الأليفة', 'Pet Services',             40, true),
  ('vet_home',         'بيطري منزلي',               'Home Vet Visit',             'stethoscope',  'pets',          'الحيوانات الأليفة', 'Pet Services',             41, true)

ON CONFLICT (slug) DO NOTHING;
