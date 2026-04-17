import { CategoryGroup, SubscriptionPlan, TierMeta } from '../types';

// ─── Service Category Groups ─────────────────────────────────

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    slug: 'maintenance',
    name_ar: 'صيانة المنازل',
    name_en: 'Home Maintenance',
    categories: [
      { id: '', slug: 'electrical',       name_ar: 'كهرباء',              name_en: 'Electrical',       group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'zap',        sort_order: 1, is_active: true },
      { id: '', slug: 'plumbing',         name_ar: 'سباكة',               name_en: 'Plumbing',         group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'droplets',   sort_order: 2, is_active: true },
      { id: '', slug: 'ac_repair',        name_ar: 'تكييف وتبريد',         name_en: 'AC & Cooling',     group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'wind',       sort_order: 3, is_active: true },
      { id: '', slug: 'carpentry',        name_ar: 'نجارة',               name_en: 'Carpentry',        group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'hammer',     sort_order: 4, is_active: true },
      { id: '', slug: 'painting',         name_ar: 'دهان وديكور',          name_en: 'Painting & Decor', group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'paintbrush', sort_order: 5, is_active: true },
      { id: '', slug: 'appliance_repair', name_ar: 'إصلاح أجهزة منزلية',  name_en: 'Appliance Repair', group_slug: 'maintenance', group_ar: 'صيانة المنازل', group_en: 'Home Maintenance', icon: 'wrench',     sort_order: 6, is_active: true },
    ],
  },
  {
    slug: 'cleaning',
    name_ar: 'تنظيف ونقل',
    name_en: 'Cleaning & Moving',
    categories: [
      { id: '', slug: 'cleaning', name_ar: 'تنظيف منزلي',        name_en: 'Home Cleaning',    group_slug: 'cleaning', group_ar: 'تنظيف ونقل', group_en: 'Cleaning & Moving', icon: 'sparkles', sort_order: 7, is_active: true },
      { id: '', slug: 'moving',   name_ar: 'نقل عفش وتوصيل',     name_en: 'Moving & Delivery', group_slug: 'cleaning', group_ar: 'تنظيف ونقل', group_en: 'Cleaning & Moving', icon: 'truck',    sort_order: 8, is_active: true },
    ],
  },
  {
    slug: 'education',
    name_ar: 'تعليم وتدريب',
    name_en: 'Education',
    categories: [
      { id: '', slug: 'tutoring',        name_ar: 'تدريس خصوصي',        name_en: 'Private Tutoring', group_slug: 'education', group_ar: 'تعليم وتدريب', group_en: 'Education', icon: 'book-open', sort_order: 9,  is_active: true },
      { id: '', slug: 'quran_teaching',  name_ar: 'تعليم قرآن وتجويد',  name_en: 'Quran Teaching',   group_slug: 'education', group_ar: 'تعليم وتدريب', group_en: 'Education', icon: 'moon',      sort_order: 10, is_active: true },
    ],
  },
  {
    slug: 'freelance',
    name_ar: 'تصميم وأعمال حرة',
    name_en: 'Design & Freelance',
    categories: [
      { id: '', slug: 'design', name_ar: 'تصميم جرافيك', name_en: 'Graphic Design', group_slug: 'freelance', group_ar: 'تصميم وأعمال حرة', group_en: 'Design & Freelance', icon: 'pen-tool', sort_order: 11, is_active: true },
    ],
  },
  {
    slug: 'car_services',
    name_ar: 'صيانة السيارات',
    name_en: 'Car Services',
    categories: [
      { id: '', slug: 'car_repair',     name_ar: 'إصلاح السيارات',       name_en: 'Car Repair',           group_slug: 'car_services', group_ar: 'صيانة السيارات', group_en: 'Car Services', icon: 'car',       sort_order: 12, is_active: true },
      { id: '', slug: 'car_electrical', name_ar: 'كهرباء السيارات',      name_en: 'Car Electrical',       group_slug: 'car_services', group_ar: 'صيانة السيارات', group_en: 'Car Services', icon: 'battery',   sort_order: 13, is_active: true },
      { id: '', slug: 'car_tires',      name_ar: 'إطارات وتغيير زيت',    name_en: 'Tires & Oil Change',   group_slug: 'car_services', group_ar: 'صيانة السيارات', group_en: 'Car Services', icon: 'gauge',     sort_order: 14, is_active: true },
      { id: '', slug: 'car_ac',         name_ar: 'تكييف السيارات',       name_en: 'Car AC & Cooling',     group_slug: 'car_services', group_ar: 'صيانة السيارات', group_en: 'Car Services', icon: 'snowflake', sort_order: 15, is_active: true },
      { id: '', slug: 'car_bodywork',   name_ar: 'هيكل ودهان السيارات',  name_en: 'Bodywork & Paint',     group_slug: 'car_services', group_ar: 'صيانة السيارات', group_en: 'Car Services', icon: 'shield',    sort_order: 16, is_active: true },
      { id: '', slug: 'car_cleaning',   name_ar: 'غسيل وتلميع السيارات', name_en: 'Car Wash & Detailing', group_slug: 'car_services', group_ar: 'صيانة السيارات', group_en: 'Car Services', icon: 'droplet',   sort_order: 17, is_active: true },
    ],
  },
];

// Flat list for quick lookup
export const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap(g => g.categories);

export const getCategoryBySlug = (slug: string) =>
  ALL_CATEGORIES.find(c => c.slug === slug);

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
  new:     { tier: 'new',     label_ar: 'جديد',   min_jobs: 0,   max_jobs: 9,   search_boost: 0,  color: '#9CA3AF' },
  rising:  { tier: 'rising',  label_ar: 'صاعد',   min_jobs: 10,  max_jobs: 24,  search_boost: 10, color: '#F59E0B' },
  trusted: { tier: 'trusted', label_ar: 'موثّق',  min_jobs: 25,  max_jobs: 49,  search_boost: 20, color: '#3B82F6' },
  expert:  { tier: 'expert',  label_ar: 'خبير',   min_jobs: 50,  max_jobs: 99,  search_boost: 30, color: '#F97316' },
  elite:   { tier: 'elite',   label_ar: 'نخبة',   min_jobs: 100, max_jobs: null, search_boost: 50, color: '#8B5CF6' },
};

// ─── Cities (Jordan MVP) ─────────────────────────────────────

export const JORDAN_CITIES = [
  'عمّان', 'الزرقاء', 'إربد', 'العقبة', 'السلط',
  'المفرق', 'جرش', 'عجلون', 'الكرك', 'معان', 'الطفيلة',
];
