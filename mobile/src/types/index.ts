// ============================================================
// WASEET — TypeScript Types
// ============================================================

export type UserRole = 'client' | 'provider' | 'admin';
export type ReputationTier = 'new' | 'rising' | 'trusted' | 'expert' | 'elite';
export type RequestStatus = 'open' | 'reviewing' | 'in_progress' | 'completed' | 'cancelled' | 'expired';
export type BidStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';
export type JobStatus = 'active' | 'completed' | 'disputed' | 'cancelled';
export type MsgType = 'text' | 'image' | 'video' | 'system' | 'audio' | 'location' | 'profile_card';
export type SubscriptionTier = 'trial' | 'basic' | 'pro' | 'premium';
export type LoyaltyEventType = 'credits_job' | 'credits_tier' | 'credits_milestone' | 'credits_five_star';

// ─── Service Categories ──────────────────────────────────────

export interface ServiceCategory {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  group_slug: string;
  group_ar: string;
  group_en: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

export interface CategoryGroup {
  slug: string;
  name_ar: string;
  name_en: string;
  categories: ServiceCategory[];
}

// ─── User ────────────────────────────────────────────────────

export interface User {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string;
  phone_verified: boolean;
  email?: string;
  avatar_url?: string;
  city: string;
  created_at: string;
}

// ─── Provider ────────────────────────────────────────────────

export interface Provider {
  id: string;
  bio?: string;
  categories: string[];
  score: number;
  reputation_tier: ReputationTier;
  lifetime_jobs: number;
  is_subscribed: boolean;
  subscription_tier?: SubscriptionTier;
  subscription_ends?: string;
  badge_verified: boolean;
  portfolio_urls: string[];
  // bid credits — two-wallet system
  subscription_credits: number;  // replaced each renewal cycle
  bonus_credits: number;         // accumulates from achievements, frozen when subscription lapses
  trial_used: boolean;
  bid_rejection_rate: number;
  // active bids
  active_bid_count?: number;
  // availability
  is_available?: boolean;
  urgent_enabled?: boolean;
  // sharing / public profile
  username?: string;
  share_count?: number;
  profile_views?: number;
  referral_clients?: number;
  show_public?: boolean;
  // joined from users
  user?: User;
}

// ─── Request ─────────────────────────────────────────────────

export interface ServiceRequest {
  id: string;
  client_id: string;
  category_slug: string;
  title: string;
  description: string;
  city: string;
  district?: string;
  image_urls: string[];
  ai_suggested_price_min?: number;
  ai_suggested_price_max?: number;
  ai_suggested_currency: string;
  status: RequestStatus;
  views_count: number;
  created_at: string;
  // urgent
  is_urgent?: boolean;
  urgent_premium_pct?: number;
  urgent_expires_at?: string;
  // bid closing
  max_bids?: number;
  bidding_ends_at?: string;
  // joined
  client?: User;
  category?: ServiceCategory;
  bids_count?: number;
}

// ─── Bid ─────────────────────────────────────────────────────

export interface Bid {
  id: string;
  request_id: string;
  provider_id: string;
  amount: number;
  currency: string;
  note?: string;
  status: BidStatus;
  created_at: string;
  // joined
  provider?: Provider & { user: User };
}

// ─── Job ─────────────────────────────────────────────────────

export interface Job {
  id: string;
  request_id: string;
  bid_id: string;
  client_id: string;
  provider_id: string;
  status: JobStatus;
  // Commitment flow (migration 015)
  client_grace_expires_at?: string;
  provider_commit_deadline?: string;
  provider_committed_at?: string;
  provider_declined?: boolean;
  // Completion flow
  confirm_code?: string;
  confirm_code_exp?: string;
  confirmed_by_client: boolean;
  confirmed_at?: string;
  // Rating
  client_rating?: number;
  client_review?: string;
  provider_rating?: number;
  created_at: string;
  // joined
  request?: ServiceRequest;
  client?: User;
  provider?: Provider & { user: User };
}

// ─── Message ─────────────────────────────────────────────────

export interface Message {
  id: string;
  job_id: string;
  sender_id: string;
  content: string;
  msg_type: MsgType;
  image_url?: string;
  video_url?: string;
  audio_url?: string;
  duration_ms?: number;
  latitude?: number;
  longitude?: number;
  location_label?: string;
  shared_provider_id?: string;
  is_read: boolean;
  created_at: string;
}

// ─── Saved Provider ──────────────────────────────────────────

export interface SavedProvider {
  id: string;
  client_id: string;
  provider_id: string;
  note?: string;
  created_at: string;
  provider?: Provider & { user: User };
}

// ─── Share Event ─────────────────────────────────────────────

export type ShareChannel = 'chat' | 'whatsapp' | 'instagram' | 'twitter' | 'link' | 'other';

export interface ShareEvent {
  id: string;
  provider_id: string;
  shared_by?: string;
  channel: ShareChannel;
  opened: boolean;
  created_at: string;
}

// ─── Portfolio ───────────────────────────────────────────────

export type PortfolioItemType = 'single' | 'before_after' | 'video';

export interface PortfolioItem {
  id: string;
  provider_id: string;
  category_slug?: string;
  title_ar?: string;
  description_ar?: string;
  item_type: PortfolioItemType;
  media_urls: string[];
  video_url?: string;
  is_verified_job: boolean;
  job_id?: string;
  views_count: number;
  created_at: string;
}

// ─── Subscription ────────────────────────────────────────────

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name_ar: string;
  name_en?: string;
  price_jod: number;
  subscription_credits: number;   // credits awarded per plan; 0 = unlimited (premium)
  max_concurrent_bids: number;    // -1 = dynamic (premium: 8→12 via bonus_credits)
  is_unlimited: boolean;
  is_trial: boolean;
}

// ─── Reputation Tier Meta ────────────────────────────────────

export interface TierMeta {
  tier: ReputationTier;
  label_ar: string;
  min_jobs: number;
  max_jobs: number | null;
  search_boost: number;
  color: string;
}

// ─── Recurring Contracts ──────────────────────────────────────

export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly';
export type ContractStatus      = 'bidding' | 'active' | 'paused' | 'completed' | 'cancelled';
export type VisitStatus         = 'scheduled' | 'completed' | 'postponed' | 'missed';

export const FREQ_LABEL: Record<RecurrenceFrequency, string> = {
  weekly:   'أسبوعي',
  biweekly: 'كل أسبوعين',
  monthly:  'شهري',
};

export const FREQ_VISITS_PER_MONTH: Record<RecurrenceFrequency, number> = {
  weekly: 4, biweekly: 2, monthly: 1,
};

export const TIME_WINDOW_LABEL: Record<string, string> = {
  morning:   'صباحاً (8-12)',
  afternoon: 'ظهراً (12-5)',
  evening:   'مساءً (5-9)',
  flexible:  'مرن',
};

export const DAY_LABELS = ['أحد','اثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];

export interface RecurringContract {
  id: string;
  client_id: string;
  provider_id?: string;
  category_slug: string;
  title: string;
  description?: string;
  city: string;
  frequency: RecurrenceFrequency;
  preferred_day?: number;
  preferred_time_window?: string;
  duration_months: 3 | 6 | 12;
  price_per_visit?: number;
  currency: string;
  status: ContractStatus;
  starts_at?: string;
  ends_at?: string;
  completed_visits: number;
  total_visits?: number;
  bids_count?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  // joined
  client_name?: string;
  client?: User;
  provider?: Provider & { user: User };
}

export interface ContractBid {
  id: string;
  contract_id: string;
  provider_id: string;
  price_per_visit: number;
  currency: string;
  note?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  created_at: string;
  provider?: Provider & { user: User };
}

export interface ContractVisit {
  id: string;
  contract_id: string;
  scheduled_at: string;
  completed_at?: string;
  status: VisitStatus;
  client_rating?: number;
  client_note?: string;
  postponed_to?: string;
  created_at: string;
}
