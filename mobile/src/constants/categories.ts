import { CategoryGroup, SubscriptionPlan, TierMeta } from '../types';

// ─── Service Category Groups ─────────────────────────────────

export const CATEGORY_GROUPS: CategoryGroup[] = [

  // ── 1. صيانة المنازل ─────────────────────────────────────
  {
    slug: 'maintenance',
    name_ar: 'صيانة المنازل',
    name_en: 'Home Maintenance',
    categories: [
      { id: '', slug: 'electrical',       name_ar: 'كهرباء',              name_en: 'Electrical',            group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'zap',          sort_order: 1,  is_active: true },
      { id: '', slug: 'plumbing',         name_ar: 'سباكة',               name_en: 'Plumbing',              group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'droplets',     sort_order: 2,  is_active: true },
      { id: '', slug: 'ac_repair',        name_ar: 'تكييف وتبريد',         name_en: 'AC & Cooling',          group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'wind',         sort_order: 3,  is_active: true },
      { id: '', slug: 'carpentry',        name_ar: 'نجارة',               name_en: 'Carpentry',             group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'hammer',       sort_order: 4,  is_active: true },
      { id: '', slug: 'painting',         name_ar: 'دهان وديكور',          name_en: 'Painting & Decor',      group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'paintbrush',   sort_order: 5,  is_active: true },
      { id: '', slug: 'appliance_repair', name_ar: 'إصلاح أجهزة منزلية',  name_en: 'Appliance Repair',      group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'wrench',       sort_order: 6,  is_active: true },
      { id: '', slug: 'tiling',           name_ar: 'بليط وأرضيات',         name_en: 'Tiling & Flooring',     group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'tile',         sort_order: 7,  is_active: true },
      { id: '', slug: 'plastering',       name_ar: 'قصارة وتشطيب',         name_en: 'Plastering & Finishing',group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'plaster',      sort_order: 8,  is_active: true },
      { id: '', slug: 'ironwork',         name_ar: 'حدادة ولحام',           name_en: 'Ironwork & Welding',    group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'iron',         sort_order: 9,  is_active: true },
      { id: '', slug: 'aluminum',         name_ar: 'ألمنيوم',              name_en: 'Aluminum Works',        group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'aluminium',    sort_order: 10, is_active: true },
      { id: '', slug: 'upholstery',       name_ar: 'تنجيد وإصلاح أثاث',   name_en: 'Upholstery & Furniture',group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'sofa',         sort_order: 11, is_active: true },
      { id: '', slug: 'gypsum',           name_ar: 'جبصين وديكور داخلي',  name_en: 'Gypsum & Drywall',      group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'gypsum',       sort_order: 12, is_active: true },
      { id: '', slug: 'renovation',       name_ar: 'أعمال بناء وترميم',   name_en: 'Renovation & Building', group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'bricks',       sort_order: 13, is_active: true },
      { id: '', slug: 'glass',            name_ar: 'زجاج ومرايا',          name_en: 'Glass & Mirrors',       group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'glass-pane',   sort_order: 14, is_active: true },
    ],
  },

  // ── 2. تنظيف ونقل ────────────────────────────────────────
  {
    slug: 'cleaning',
    name_ar: 'تنظيف ونقل',
    name_en: 'Cleaning & Moving',
    categories: [
      { id: '', slug: 'cleaning', name_ar: 'تنظيف منزلي',       name_en: 'Home Cleaning',     group_slug: 'cleaning', group_ar: 'تنظيف ونقل', group_en: 'Cleaning & Moving', icon: 'sparkles', sort_order: 15, is_active: true },
      { id: '', slug: 'moving',   name_ar: 'نقل عفش وتوصيل',    name_en: 'Moving & Delivery', group_slug: 'cleaning', group_ar: 'تنظيف ونقل', group_en: 'Cleaning & Moving', icon: 'truck',    sort_order: 16, is_active: true },
    ],
  },

  // ── 3. الخدمات الفنية (جديد) ──────────────────────────────
  {
    slug: 'technical',
    name_ar: 'الخدمات الفنية',
    name_en: 'Technical Services',
    categories: [
      { id: '', slug: 'networking',      name_ar: 'شبكات وإنترنت',            name_en: 'Networks & Internet',       group_slug: 'technical', group_ar: 'الخدمات الفنية', group_en: 'Technical Services', icon: 'wifi',         sort_order: 17, is_active: true },
      { id: '', slug: 'cctv',            name_ar: 'كاميرات مراقبة',            name_en: 'CCTV & Surveillance',       group_slug: 'technical', group_ar: 'الخدمات الفنية', group_en: 'Technical Services', icon: 'cctv',         sort_order: 18, is_active: true },
      { id: '', slug: 'solar',           name_ar: 'أنظمة الطاقة الشمسية',     name_en: 'Solar Energy Systems',      group_slug: 'technical', group_ar: 'الخدمات الفنية', group_en: 'Technical Services', icon: 'solar-panel',  sort_order: 19, is_active: true },
      { id: '', slug: 'alarm_fire',      name_ar: 'إنذار وأنظمة حريق',        name_en: 'Alarm & Fire Systems',      group_slug: 'technical', group_ar: 'الخدمات الفنية', group_en: 'Technical Services', icon: 'fire-alarm',   sort_order: 20, is_active: true },
      { id: '', slug: 'electronics',     name_ar: 'إلكترونيات وأجهزة',        name_en: 'Electronics & Devices',     group_slug: 'technical', group_ar: 'الخدمات الفنية', group_en: 'Technical Services', icon: 'desktop',      sort_order: 21, is_active: true },
      { id: '', slug: 'computer_repair', name_ar: 'صيانة حاسوب وطابعات',      name_en: 'Computer & Printer Repair', group_slug: 'technical', group_ar: 'الخدمات الفنية', group_en: 'Technical Services', icon: 'laptop',       sort_order: 22, is_active: true },
    ],
  },

  // ── 4. الصحة والعناية (جديد) ─────────────────────────────
  {
    slug: 'health_beauty',
    name_ar: 'الصحة والعناية',
    name_en: 'Health & Beauty',
    categories: [
      { id: '', slug: 'cupping_massage', name_ar: 'حجامة ومساج',           name_en: 'Cupping & Massage',    group_slug: 'health_beauty', group_ar: 'الصحة والعناية', group_en: 'Health & Beauty', icon: 'massage',      sort_order: 23, is_active: true },
      { id: '', slug: 'home_nursing',    name_ar: 'تمريض وعناية منزلية',   name_en: 'Home Nursing & Care',  group_slug: 'health_beauty', group_ar: 'الصحة والعناية', group_en: 'Health & Beauty', icon: 'nurse',        sort_order: 24, is_active: true },
      { id: '', slug: 'beauty_barber',   name_ar: 'حلاقة وتجميل منزلي',    name_en: 'Home Beauty & Barber', group_slug: 'health_beauty', group_ar: 'الصحة والعناية', group_en: 'Health & Beauty', icon: 'haircut',      sort_order: 25, is_active: true },
    ],
  },

  // ── 5. المناسبات والفعاليات (جديد) ───────────────────────
  {
    slug: 'events',
    name_ar: 'المناسبات والفعاليات',
    name_en: 'Events & Occasions',
    categories: [
      { id: '', slug: 'photography',  name_ar: 'تصوير فوتوغرافي وفيديو', name_en: 'Photography & Video', group_slug: 'events', group_ar: 'المناسبات والفعاليات', group_en: 'Events & Occasions', icon: 'photo',    sort_order: 26, is_active: true },
      { id: '', slug: 'pastry_cakes', name_ar: 'حلويات وكيك مناسبات',    name_en: 'Pastry & Cakes',      group_slug: 'events', group_ar: 'المناسبات والفعاليات', group_en: 'Events & Occasions', icon: 'cake',     sort_order: 27, is_active: true },
      { id: '', slug: 'event_decor',  name_ar: 'تنسيق وتزيين مناسبات',   name_en: 'Event Decoration',    group_slug: 'events', group_ar: 'المناسبات والفعاليات', group_en: 'Events & Occasions', icon: 'party',    sort_order: 28, is_active: true },
    ],
  },

  // ── 6. تعليم وتدريب ──────────────────────────────────────
  {
    slug: 'education',
    name_ar: 'تعليم وتدريب',
    name_en: 'Education & Training',
    categories: [
      { id: '', slug: 'tutoring',       name_ar: 'تدريس خصوصي',        name_en: 'Private Tutoring', group_slug: 'education', group_ar: 'تعليم وتدريب', group_en: 'Education & Training', icon: 'book-open', sort_order: 29, is_active: true },
      { id: '', slug: 'quran_teaching', name_ar: 'تعليم قرآن وتجويد',  name_en: 'Quran Teaching',   group_slug: 'education', group_ar: 'تعليم وتدريب', group_en: 'Education & Training', icon: 'moon',      sort_order: 30, is_active: true },
    ],
  },

  // ── 7. تصميم وأعمال حرة ──────────────────────────────────
  {
    slug: 'freelance',
    name_ar: 'تصميم وأعمال حرة',
    name_en: 'Design & Freelance',
    categories: [
      { id: '', slug: 'design',              name_ar: 'تصميم جرافيك',              name_en: 'Graphic Design',        group_slug: 'freelance', group_ar: 'تصميم وأعمال حرة', group_en: 'Design & Freelance', icon: 'pen-tool',     sort_order: 31, is_active: true },
      { id: '', slug: 'web_design',          name_ar: 'تصميم مواقع وتطبيقات',     name_en: 'Web & App Design',      group_slug: 'freelance', group_ar: 'تصميم وأعمال حرة', group_en: 'Design & Freelance', icon: 'code-bracket', sort_order: 32, is_active: true },
      { id: '', slug: 'digital_marketing',   name_ar: 'تسويق رقمي وسوشيال ميديا', name_en: 'Digital Marketing',     group_slug: 'freelance', group_ar: 'تصميم وأعمال حرة', group_en: 'Design & Freelance', icon: 'chart-up',     sort_order: 33, is_active: true },
      { id: '', slug: 'writing_translation', name_ar: 'كتابة وترجمة',              name_en: 'Writing & Translation', group_slug: 'freelance', group_ar: 'تصميم وأعمال حرة', group_en: 'Design & Freelance', icon: 'document',     sort_order: 34, is_active: true },
      { id: '', slug: 'accounting',          name_ar: 'محاسبة وأعمال مالية',       name_en: 'Accounting & Finance',  group_slug: 'freelance', group_ar: 'تصميم وأعمال حرة', group_en: 'Design & Freelance', icon: 'calculator',   sort_order: 35, is_active: true },
    ],
  },

  // ── 8. الحِرَف اليدوية والتقليدية (جديد) ─────────────────
  {
    slug: 'handicrafts',
    name_ar: 'الحِرَف اليدوية والتقليدية',
    name_en: 'Handicrafts & Traditions',
    categories: [
      { id: '', slug: 'tailoring',  name_ar: 'خياطة وتفصيل',        name_en: 'Tailoring & Sewing',  group_slug: 'handicrafts', group_ar: 'الحِرَف اليدوية والتقليدية', group_en: 'Handicrafts & Traditions', icon: 'thread',    sort_order: 36, is_active: true },
      { id: '', slug: 'embroidery', name_ar: 'تطريز وأعمال يدوية',  name_en: 'Embroidery & Crafts', group_slug: 'handicrafts', group_ar: 'الحِرَف اليدوية والتقليدية', group_en: 'Handicrafts & Traditions', icon: 'stitch',    sort_order: 37, is_active: true },
      { id: '', slug: 'shoemaking', name_ar: 'صناعة وإصلاح أحذية', name_en: 'Shoemaking & Repair', group_slug: 'handicrafts', group_ar: 'الحِرَف اليدوية والتقليدية', group_en: 'Handicrafts & Traditions', icon: 'shoe',      sort_order: 38, is_active: true },
    ],
  },

  // ── 9. الحيوانات الأليفة (جديد) ──────────────────────────
  {
    slug: 'pets',
    name_ar: 'الحيوانات الأليفة',
    name_en: 'Pet Services',
    categories: [
      { id: '', slug: 'pet_grooming', name_ar: 'تجميل ورعاية الحيوانات', name_en: 'Pet Grooming & Care', group_slug: 'pets', group_ar: 'الحيوانات الأليفة', group_en: 'Pet Services', icon: 'paw',         sort_order: 39, is_active: true },
      { id: '', slug: 'pet_training', name_ar: 'تدريب الحيوانات',        name_en: 'Pet Training',        group_slug: 'pets', group_ar: 'الحيوانات الأليفة', group_en: 'Pet Services', icon: 'dog-lead',    sort_order: 40, is_active: true },
      { id: '', slug: 'vet_home',     name_ar: 'بيطري منزلي',             name_en: 'Home Vet Visit',      group_slug: 'pets', group_ar: 'الحيوانات الأليفة', group_en: 'Pet Services', icon: 'stethoscope', sort_order: 41, is_active: true },
    ],
  },

  // ── 10. صيانة السيارات ───────────────────────────────────
  {
    slug: 'car_services',
    name_ar: 'صيانة السيارات',
    name_en: 'Car Services',
    categories: [
      { id: '', slug: 'car_repair',     name_ar: 'إصلاح السيارات',        name_en: 'Car Repair',           group_slug: 'car_services', group_ar: 'صيانة السيارات', group_en: 'Car Services', icon: 'car',       sort_order: 42, is_active: true },
      { id: '', slug: 'car_electrical', name_ar: 'كهرباء السيارات',       name_en: 'Car Electrical',       group_slug: 'car_services', group_ar: 'صيانة السيارات', group_en: 'Car Services', icon: 'battery',   sort_order: 43, is_active: true },
      { id: '', slug: 'car_tires',      name_ar: 'إطارات وتغيير زيت',     name_en: 'Tires & Oil Change',   group_slug: 'car_services', group_ar: 'صيانة السيارات', group_en: 'Car Services', icon: 'gauge',     sort_order: 44, is_active: true },
      { id: '', slug: 'car_ac',         name_ar: 'تكييف السيارات',        name_en: 'Car AC & Cooling',     group_slug: 'car_services', group_ar: 'صيانة السيارات', group_en: 'Car Services', icon: 'snowflake', sort_order: 45, is_active: true },
      { id: '', slug: 'car_bodywork',   name_ar: 'هيكل ودهان السيارات',   name_en: 'Bodywork & Paint',     group_slug: 'car_services', group_ar: 'صيانة السيارات', group_en: 'Car Services', icon: 'shield',    sort_order: 46, is_active: true },
      { id: '', slug: 'car_cleaning',   name_ar: 'غسيل وتلميع السيارات',  name_en: 'Car Wash & Detailing', group_slug: 'car_services', group_ar: 'صيانة السيارات', group_en: 'Car Services', icon: 'droplet',   sort_order: 47, is_active: true },
    ],
  },
];

// Flat list for quick lookup
export const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap(g => g.categories);

export const getCategoryBySlug = (slug: string) =>
  ALL_CATEGORIES.find(c => c.slug === slug);

// ─── Category-aware placeholder examples ─────────────────────
export const CATEGORY_PLACEHOLDERS: Record<string, { title_ar: string; title_en: string; desc_ar: string; desc_en: string }> = {
  electrical:          { title_ar: 'مثال: قاطع كهربائي يتعطل باستمرار',        title_en: 'e.g. Circuit breaker keeps tripping',                desc_ar: 'حدد موقع المشكلة وعدد النقاط المتضررة',                          desc_en: 'Describe the issue location and number of affected points' },
  plumbing:            { title_ar: 'مثال: تسرب مياه تحت المغسلة',               title_en: 'e.g. Leaking pipe under the sink',                   desc_ar: 'اذكر مكان التسرب وهل يوجد انسداد أيضاً',                        desc_en: 'Mention leak location and whether there is blockage too' },
  ac_repair:           { title_ar: 'مثال: تكييف غرفة النوم لا يبرد',            title_en: 'e.g. Bedroom AC not cooling properly',               desc_ar: 'اذكر الموديل إن أمكن وأعراض المشكلة بوضوح',                     desc_en: 'Mention the model if possible and describe symptoms clearly' },
  carpentry:           { title_ar: 'مثال: إصلاح باب خشبي لا يُغلق جيداً',      title_en: 'e.g. Wooden door that won\'t close properly',        desc_ar: 'صف العطل وهل تريد إصلاحاً أو استبدالاً',                       desc_en: 'Describe the issue and whether you need repair or replacement' },
  painting:            { title_ar: 'مثال: دهان جدران غرفة المعيشة',             title_en: 'e.g. Painting the living room walls',                desc_ar: 'حدد المساحة والألوان المطلوبة وهل تريد ورق جدران',               desc_en: 'Specify area, desired colors, and whether wallpaper is needed' },
  appliance_repair:    { title_ar: 'مثال: غسالة لا تدور وتصدر صوتاً',           title_en: 'e.g. Washing machine making noise and not spinning', desc_ar: 'اذكر الموديل والمشكلة الظاهرة ومتى بدأت',                       desc_en: 'Mention the model, visible problem, and when it started' },
  tiling:              { title_ar: 'مثال: تبليط حمام أو مطبخ',                  title_en: 'e.g. Tiling bathroom or kitchen floor',              desc_ar: 'حدد المساحة وهل لديك بلاط أم تحتاج توريده',                    desc_en: 'Specify the area and whether you have tiles or need supply' },
  plastering:          { title_ar: 'مثال: إصلاح شقوق الجدران وإعادة القصارة',   title_en: 'e.g. Fix wall cracks and replaster',                 desc_ar: 'حدد عدد الغرف ومساحة الجدران المتضررة',                         desc_en: 'Specify number of rooms and area of damaged walls' },
  ironwork:            { title_ar: 'مثال: درابزين حديدي للسلم',                  title_en: 'e.g. Iron railing for the staircase',                desc_ar: 'حدد الطول المطلوب والتصميم المفضل',                             desc_en: 'Specify the required length and preferred design' },
  aluminum:            { title_ar: 'مثال: نافذة ألمنيوم مزدوجة الزجاج',         title_en: 'e.g. Double-glazed aluminum window',                 desc_ar: 'أذكر القياسات والموقع ونوع الفتح المطلوب',                      desc_en: 'Mention dimensions, location, and type of opening required' },
  upholstery:          { title_ar: 'مثال: تنجيد كنبة 3 مقاعد',                  title_en: 'e.g. Reupholstering a 3-seat sofa',                 desc_ar: 'صف نوع الأثاث والقماش والألوان المفضلة',                        desc_en: 'Describe furniture type, fabric, and preferred colors' },
  gypsum:              { title_ar: 'مثال: أسقف جبصين لغرفة المعيشة',            title_en: 'e.g. Gypsum ceiling for the living room',            desc_ar: 'حدد المساحة والتصميم المطلوب وهل تريد إضاءة مدمجة',             desc_en: 'Specify area, required design, and whether built-in lighting is needed' },
  renovation:          { title_ar: 'مثال: ترميم شامل لشقة قديمة',               title_en: 'e.g. Full renovation of an old apartment',           desc_ar: 'حدد عدد الغرف والأعمال المطلوبة (سباكة، كهرباء، دهان…)',        desc_en: 'Specify rooms and required works (plumbing, electrical, painting…)' },
  glass:               { title_ar: 'مثال: استبدال زجاج نافذة مكسورة',           title_en: 'e.g. Replace broken window glass',                   desc_ar: 'أذكر القياسات ونوع الزجاج المطلوب',                             desc_en: 'Mention dimensions and type of glass required' },
  cleaning:            { title_ar: 'مثال: تنظيف عميق لشقة بعد فترة سفر',       title_en: 'e.g. Deep cleaning after a long trip',               desc_ar: 'حدد عدد الغرف والمساحة والخدمات المطلوبة',                     desc_en: 'Specify number of rooms, area, and required services' },
  moving:              { title_ar: 'مثال: نقل أثاث من عمان إلى إربد',           title_en: 'e.g. Moving furniture from Amman to Irbid',          desc_ar: 'أذكر العنوانين وعدد القطع الكبيرة والطابق',                     desc_en: 'Mention both addresses, number of large items, and floor' },
  networking:          { title_ar: 'مثال: تمديد شبكة إنترنت بالأسلاك للشقة',   title_en: 'e.g. Wired internet network for apartment',          desc_ar: 'حدد عدد الأجهزة والغرف وسرعة الإنترنت المطلوبة',                desc_en: 'Specify number of devices, rooms, and required internet speed' },
  cctv:                { title_ar: 'مثال: تركيب 4 كاميرات مراقبة',              title_en: 'e.g. Install 4 surveillance cameras',               desc_ar: 'حدد عدد الكاميرات والمواقع وهل تريد تسجيلاً',                  desc_en: 'Specify number of cameras, locations, and recording needs' },
  solar:               { title_ar: 'مثال: نظام طاقة شمسية 5 كيلوواط',           title_en: 'e.g. 5 kW solar energy system',                     desc_ar: 'أذكر استهلاكك الشهري من الكهرباء ونوع الاستخدام',               desc_en: 'Mention your monthly electricity consumption and usage type' },
  alarm_fire:          { title_ar: 'مثال: نظام إنذار حريق لمحل تجاري',          title_en: 'e.g. Fire alarm system for a commercial shop',       desc_ar: 'حدد مساحة المكان وعدد النقاط المطلوبة',                         desc_en: 'Specify place area and number of points required' },
  electronics:         { title_ar: 'مثال: إصلاح تلفاز لا يشتغل',               title_en: 'e.g. Repair a TV that won\'t turn on',              desc_ar: 'اذكر الماركة والموديل والعطل الظاهر',                           desc_en: 'Mention brand, model, and visible malfunction' },
  computer_repair:     { title_ar: 'مثال: حاسوب يُعيد التشغيل بشكل مفاجئ',     title_en: 'e.g. Computer restarting unexpectedly',             desc_ar: 'صف المشكلة ومتى تحدث وعمر الجهاز',                             desc_en: 'Describe the problem, when it occurs, and device age' },
  cupping_massage:     { title_ar: 'مثال: جلسة مساج كامل في المنزل',            title_en: 'e.g. Full body massage session at home',            desc_ar: 'حدد المدة المفضلة ونوع المساج وعدد الأشخاص',                   desc_en: 'Specify preferred duration, massage type, and number of people' },
  home_nursing:        { title_ar: 'مثال: ممرض منزلي لمريض بعد العملية',        title_en: 'e.g. Home nurse for post-surgery care',             desc_ar: 'اذكر طبيعة الحالة وعدد ساعات الرعاية المطلوبة',                desc_en: 'Mention the condition and required hours of care' },
  beauty_barber:       { title_ar: 'مثال: قص وتسريح شعر في المنزل',             title_en: 'e.g. Home haircut and styling',                     desc_ar: 'حدد عدد الأشخاص والخدمات المطلوبة',                            desc_en: 'Specify number of people and required services' },
  photography:         { title_ar: 'مثال: تصوير حفل تخرج',                      title_en: 'e.g. Graduation ceremony photography',             desc_ar: 'أذكر نوع المناسبة وعدد الساعات وهل تريد فيديو',                desc_en: 'Mention the event type, hours needed, and whether video is needed' },
  pastry_cakes:        { title_ar: 'مثال: كيكة عيد ميلاد مزخرفة',               title_en: 'e.g. Decorated birthday cake',                      desc_ar: 'حدد الحجم والتصميم والنكهة وعدد الأشخاص',                      desc_en: 'Specify size, design, flavor, and number of people' },
  event_decor:         { title_ar: 'مثال: تزيين حفل خطوبة',                     title_en: 'e.g. Engagement party decoration',                  desc_ar: 'حدد نوع المناسبة والمكان والألوان المفضلة',                     desc_en: 'Specify event type, venue, and preferred colors' },
  tutoring:            { title_ar: 'مثال: تدريس رياضيات للثانوية العامة',        title_en: 'e.g. High school math tutoring',                    desc_ar: 'أذكر المادة والمستوى وعدد الحصص المطلوبة أسبوعياً',             desc_en: 'Mention the subject, grade level, and weekly sessions needed' },
  quran_teaching:      { title_ar: 'مثال: تعليم تجويد القرآن للأطفال',           title_en: 'e.g. Quran recitation teaching for children',       desc_ar: 'حدد العمر والمستوى وعدد الجلسات أسبوعياً',                     desc_en: 'Specify age, level, and weekly sessions' },
  design:              { title_ar: 'مثال: تصميم شعار لمشروع',                   title_en: 'e.g. Logo design for a business',                   desc_ar: 'صف الفكرة والألوان المفضلة وعدد التعديلات المطلوبة',            desc_en: 'Describe the concept, preferred colors, and required revisions' },
  web_design:          { title_ar: 'مثال: تصميم موقع لمتجر إلكتروني',           title_en: 'e.g. Website design for an online store',           desc_ar: 'أذكر عدد الصفحات والميزات المطلوبة والأمثلة المفضلة',           desc_en: 'Mention page count, required features, and preferred examples' },
  digital_marketing:   { title_ar: 'مثال: إدارة صفحات سوشيال ميديا شهرياً',    title_en: 'e.g. Monthly social media management',              desc_ar: 'حدد المنصات والعدد الشهري للمنشورات والأهداف',                 desc_en: 'Specify platforms, monthly post count, and goals' },
  writing_translation: { title_ar: 'مثال: ترجمة مقال من الإنجليزية للعربية',    title_en: 'e.g. Article translation from English to Arabic',   desc_ar: 'أذكر عدد الكلمات والمجال والمستوى المطلوب',                    desc_en: 'Mention word count, field, and required level' },
  accounting:          { title_ar: 'مثال: مسك دفاتر محاسبية لمتجر صغير',        title_en: 'e.g. Bookkeeping for a small shop',                 desc_ar: 'حدد حجم التعاملات والفترة المالية المطلوبة',                    desc_en: 'Specify transaction volume and required financial period' },
  tailoring:           { title_ar: 'مثال: تفصيل قميص رجالي',                    title_en: 'e.g. Custom-tailored men\'s shirt',                 desc_ar: 'حدد النوع والقماش والمقاسات المطلوبة',                          desc_en: 'Specify type, fabric, and required measurements' },
  embroidery:          { title_ar: 'مثال: تطريز اسم على عباءة',                  title_en: 'e.g. Embroidery name on an abaya',                  desc_ar: 'أذكر التصميم واللون والقماش المراد التطريز عليه',                desc_en: 'Mention design, color, and fabric to be embroidered on' },
  shoemaking:          { title_ar: 'مثال: إصلاح حذاء جلد',                      title_en: 'e.g. Repair leather shoes',                         desc_ar: 'صف العيب ونوع الحذاء والإصلاح المطلوب',                        desc_en: 'Describe the defect, shoe type, and required repair' },
  pet_grooming:        { title_ar: 'مثال: تجميل كلب جولدن ريتريفر',             title_en: 'e.g. Golden Retriever grooming',                    desc_ar: 'أذكر نوع الحيوان والخدمات المطلوبة (حمام، قص، تلميع)',           desc_en: 'Mention the animal type and required services (bath, trim, polish)' },
  pet_training:        { title_ar: 'مثال: تدريب كلب على الإطاعة',               title_en: 'e.g. Dog obedience training',                       desc_ar: 'حدد نوع الحيوان وعمره والسلوكيات المطلوب تعديلها',              desc_en: 'Specify animal type, age, and behaviors to be corrected' },
  vet_home:            { title_ar: 'مثال: كشف بيطري على قطة في المنزل',          title_en: 'e.g. Home vet checkup for a cat',                   desc_ar: 'أذكر نوع الحيوان والأعراض أو الحالة المطلوبة',                  desc_en: 'Mention the animal type and symptoms or required condition' },
  car_repair:          { title_ar: 'مثال: صوت غريب من محرك السيارة',             title_en: 'e.g. Strange noise from car engine',                desc_ar: 'صف الصوت ومتى يظهر ونوع السيارة وسنة الصنع',                   desc_en: 'Describe the sound, when it occurs, car type, and year' },
  car_electrical:      { title_ar: 'مثال: بطارية سيارة لا تشحن',                title_en: 'e.g. Car battery not charging',                     desc_ar: 'أذكر نوع السيارة وعمر البطارية والأعراض الظاهرة',               desc_en: 'Mention car type, battery age, and visible symptoms' },
  car_tires:           { title_ar: 'مثال: تغيير إطار مثقوب وتوازن العجلات',     title_en: 'e.g. Replace flat tire and balance wheels',         desc_ar: 'أذكر نوع السيارة والإطارات وهل تحتاج فحص الضغط',               desc_en: 'Mention car type, tires, and whether pressure check is needed' },
  car_ac:              { title_ar: 'مثال: تكييف السيارة يعمل لكن لا يبرد',      title_en: 'e.g. Car AC runs but doesn\'t cool',               desc_ar: 'اذكر نوع السيارة ومتى ظهرت المشكلة',                           desc_en: 'Mention car type and when the issue appeared' },
  car_bodywork:        { title_ar: 'مثال: إصلاح خدش في باب السيارة الأيمن',     title_en: 'e.g. Fix scratch on right car door',                desc_ar: 'صف الضرر ومكانه وهل تريد دهاناً كاملاً أو جزئياً',             desc_en: 'Describe damage location and whether full or partial paint is needed' },
  car_cleaning:        { title_ar: 'مثال: غسيل وتلميع سيارة كاملة',             title_en: 'e.g. Full car wash and polish',                     desc_ar: 'حدد نوع الغسيل (خارجي، داخلي، أو شامل)',                        desc_en: 'Specify wash type (exterior, interior, or full detail)' },
};

// ─── Subscription Plans ──────────────────────────────────────

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { tier: 'trial',   name_ar: 'تجريبية', name_en: 'Trial',   price_jod: 0,  bid_credits: 10,  is_unlimited: false, is_trial: true  },
  { tier: 'basic',   name_ar: 'أساسية',  name_en: 'Basic',   price_jod: 5,  bid_credits: 20,  is_unlimited: false, is_trial: false },
  { tier: 'pro',     name_ar: 'محترف',   name_en: 'Pro',     price_jod: 12, bid_credits: 50,  is_unlimited: false, is_trial: false },
  { tier: 'premium', name_ar: 'نخبة',    name_en: 'Elite',   price_jod: 22, bid_credits: -1,  is_unlimited: true,  is_trial: false },
];

// Credit cost per bid type
export const CREDIT_COST = { normal: 1, urgent: 2, contract: 3 } as const;

// Renewal discount by reputation tier (%)
export const REP_DISCOUNT: Record<string, number> = {
  new: 0, rising: 2, trusted: 5, expert: 8, elite: 12,
};

// ─── Reputation Tier Meta ────────────────────────────────────

export const TIER_META: Record<string, TierMeta> = {
  new:     { tier: 'new',     label_ar: 'جديد',   min_jobs: 0,   max_jobs: 9,    search_boost: 0,  color: '#9CA3AF' },
  rising:  { tier: 'rising',  label_ar: 'صاعد',   min_jobs: 10,  max_jobs: 24,   search_boost: 10, color: '#F59E0B' },
  trusted: { tier: 'trusted', label_ar: 'موثّق',  min_jobs: 25,  max_jobs: 49,   search_boost: 20, color: '#3B82F6' },
  expert:  { tier: 'expert',  label_ar: 'خبير',   min_jobs: 50,  max_jobs: 99,   search_boost: 30, color: '#F97316' },
  elite:   { tier: 'elite',   label_ar: 'نخبة',   min_jobs: 100, max_jobs: null, search_boost: 50, color: '#8B5CF6' },
};

// ─── Cities (Jordan) ─────────────────────────────────────────

export const JORDAN_CITIES = [
  'عمّان', 'الزرقاء', 'إربد', 'العقبة', 'السلط',
  'المفرق', 'جرش', 'عجلون', 'الكرك', 'معان', 'الطفيلة',
];
