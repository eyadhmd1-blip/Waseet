-- ============================================================
-- WASEET — Complete Database Schema
-- v1.0 | April 2026
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role         AS ENUM ('client', 'provider', 'admin');
CREATE TYPE reputation_tier   AS ENUM ('new', 'rising', 'trusted', 'expert', 'elite');
CREATE TYPE request_status    AS ENUM ('open', 'in_progress', 'completed', 'cancelled');
CREATE TYPE bid_status        AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');
CREATE TYPE job_status        AS ENUM ('active', 'completed', 'disputed', 'cancelled');
CREATE TYPE msg_type          AS ENUM ('text', 'image', 'system');
CREATE TYPE loyalty_event_type AS ENUM ('discount_20', 'discount_30', 'free_month', 'elite_status');
CREATE TYPE subscription_tier AS ENUM ('basic', 'pro', 'premium');

-- ============================================================
-- SERVICE CATEGORIES
-- ============================================================

CREATE TABLE service_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,          -- e.g. 'electrical'
  name_ar     TEXT NOT NULL,                 -- كهرباء
  name_en     TEXT NOT NULL,                 -- Electrical
  group_slug  TEXT NOT NULL,                 -- e.g. 'maintenance'
  group_ar    TEXT NOT NULL,                 -- صيانة المنازل
  group_en    TEXT NOT NULL,                 -- Home Maintenance
  icon        TEXT NOT NULL,                 -- icon name (e.g. 'zap')
  sort_order  INT  NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: MVP categories
INSERT INTO service_categories (slug, name_ar, name_en, group_slug, group_ar, group_en, icon, sort_order) VALUES
  -- صيانة المنازل
  ('electrical',       'كهرباء',               'Electrical',         'maintenance', 'صيانة المنازل', 'Home Maintenance', 'zap',          1),
  ('plumbing',         'سباكة',                'Plumbing',           'maintenance', 'صيانة المنازل', 'Home Maintenance', 'droplets',     2),
  ('ac_repair',        'تكييف وتبريد',          'AC & Cooling',       'maintenance', 'صيانة المنازل', 'Home Maintenance', 'wind',         3),
  ('carpentry',        'نجارة',                'Carpentry',          'maintenance', 'صيانة المنازل', 'Home Maintenance', 'hammer',       4),
  ('painting',         'دهان وديكور',           'Painting & Decor',   'maintenance', 'صيانة المنازل', 'Home Maintenance', 'paintbrush',   5),
  ('appliance_repair', 'إصلاح أجهزة منزلية',    'Appliance Repair',   'maintenance', 'صيانة المنازل', 'Home Maintenance', 'wrench',       6),
  -- تنظيف ونقل
  ('cleaning',         'تنظيف منزلي',           'Home Cleaning',      'cleaning',    'تنظيف ونقل',   'Cleaning & Moving','sparkles',     7),
  ('moving',           'نقل عفش وتوصيل',        'Moving & Delivery',  'cleaning',    'تنظيف ونقل',   'Cleaning & Moving','truck',        8),
  -- تعليم وتدريب
  ('tutoring',         'تدريس خصوصي',           'Private Tutoring',   'education',   'تعليم وتدريب', 'Education',        'book-open',    9),
  ('quran_teaching',   'تعليم قرآن وتجويد',     'Quran Teaching',     'education',   'تعليم وتدريب', 'Education',        'moon',         10),
  -- تصميم وأعمال حرة
  ('design',           'تصميم جرافيك',          'Graphic Design',     'freelance',   'تصميم وأعمال حرة', 'Design & Freelance', 'pen-tool', 11);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role          user_role    NOT NULL DEFAULT 'client',
  full_name     TEXT         NOT NULL,
  phone         TEXT         NOT NULL UNIQUE,
  phone_verified BOOLEAN     NOT NULL DEFAULT false,
  email         TEXT         UNIQUE,
  avatar_url    TEXT,
  city          TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROVIDERS  (one row per user with role='provider')
-- ============================================================

CREATE TABLE providers (
  id                 UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio                TEXT,
  categories         TEXT[]       NOT NULL DEFAULT '{}',   -- slugs array
  score              NUMERIC(3,2) NOT NULL DEFAULT 0.00,   -- rolling avg 0–5
  reputation_tier    reputation_tier NOT NULL DEFAULT 'new',
  lifetime_jobs      INT          NOT NULL DEFAULT 0,
  is_subscribed      BOOLEAN      NOT NULL DEFAULT false,
  subscription_tier  subscription_tier,
  subscription_ends  TIMESTAMPTZ,
  badge_verified     BOOLEAN      NOT NULL DEFAULT false,
  loyalty_discount   INT          NOT NULL DEFAULT 0,      -- % off next renewal
  free_months_earned INT          NOT NULL DEFAULT 0,
  portfolio_urls     TEXT[]       NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REQUESTS  (posted by clients)
-- ============================================================

CREATE TABLE requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_slug       TEXT         NOT NULL REFERENCES service_categories(slug),
  title               TEXT         NOT NULL,
  description         TEXT         NOT NULL,
  city                TEXT         NOT NULL,
  district            TEXT,
  image_urls          TEXT[]       NOT NULL DEFAULT '{}',
  ai_suggested_price_min  NUMERIC(10,2),
  ai_suggested_price_max  NUMERIC(10,2),
  ai_suggested_currency   TEXT     DEFAULT 'JOD',
  status              request_status NOT NULL DEFAULT 'open',
  views_count         INT          NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- BIDS  (submitted by subscribed providers)
-- ============================================================

CREATE TABLE bids (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   UUID         NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  provider_id  UUID         NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  amount       NUMERIC(10,2) NOT NULL,
  currency     TEXT         NOT NULL DEFAULT 'JOD',
  note         TEXT,
  status       bid_status   NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (request_id, provider_id)
);

-- ============================================================
-- JOBS  (created when client accepts a bid)
-- ============================================================

CREATE TABLE jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id          UUID         NOT NULL REFERENCES requests(id),
  bid_id              UUID         NOT NULL REFERENCES bids(id),
  client_id           UUID         NOT NULL REFERENCES users(id),
  provider_id         UUID         NOT NULL REFERENCES providers(id),
  status              job_status   NOT NULL DEFAULT 'active',
  -- Confirmation (code-based, in-app only)
  confirm_code        VARCHAR(6),
  confirm_code_exp    TIMESTAMPTZ,
  confirmed_by_client BOOLEAN      NOT NULL DEFAULT false,
  confirmed_at        TIMESTAMPTZ,
  -- Ratings (unlocked after confirmation)
  client_rating       SMALLINT     CHECK (client_rating BETWEEN 1 AND 5),
  client_review       TEXT,
  provider_rating     SMALLINT     CHECK (provider_rating BETWEEN 1 AND 5),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MESSAGES  (in-app chat per job)
-- ============================================================

CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID         NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  sender_id   UUID         NOT NULL REFERENCES users(id),
  content     TEXT         NOT NULL,
  msg_type    msg_type     NOT NULL DEFAULT 'text',
  image_url   TEXT,
  is_read     BOOLEAN      NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROVIDER ANALYTICS  (one row per provider per day)
-- ============================================================

CREATE TABLE provider_analytics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   UUID    NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  date          DATE    NOT NULL,
  views         INT     NOT NULL DEFAULT 0,
  bids_placed   INT     NOT NULL DEFAULT 0,
  bids_won      INT     NOT NULL DEFAULT 0,
  jobs_done     INT     NOT NULL DEFAULT 0,
  earnings_est  NUMERIC(10,2) NOT NULL DEFAULT 0,
  UNIQUE (provider_id, date)
);

-- ============================================================
-- LOYALTY EVENTS
-- ============================================================

CREATE TABLE loyalty_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id    UUID              NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  event_type     loyalty_event_type NOT NULL,
  jobs_at_event  INT               NOT NULL,
  reward_value   TEXT              NOT NULL,   -- e.g. '20%', '1 month'
  created_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================

CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     UUID              NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  tier            subscription_tier NOT NULL,
  amount_paid     NUMERIC(10,2)     NOT NULL,
  currency        TEXT              NOT NULL DEFAULT 'USD',
  discount_pct    INT               NOT NULL DEFAULT 0,
  period_start    TIMESTAMPTZ       NOT NULL,
  period_end      TIMESTAMPTZ       NOT NULL,
  paddle_txn_id   TEXT,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_requests_status      ON requests(status);
CREATE INDEX idx_requests_category    ON requests(category_slug);
CREATE INDEX idx_requests_city        ON requests(city);
CREATE INDEX idx_requests_client      ON requests(client_id);
CREATE INDEX idx_bids_request         ON bids(request_id);
CREATE INDEX idx_bids_provider        ON bids(provider_id);
CREATE INDEX idx_jobs_client          ON jobs(client_id);
CREATE INDEX idx_jobs_provider        ON jobs(provider_id);
CREATE INDEX idx_jobs_status          ON jobs(status);
CREATE INDEX idx_messages_job         ON messages(job_id);
CREATE INDEX idx_analytics_provider   ON provider_analytics(provider_id, date);

-- ============================================================
-- TRIGGER 1: trg_update_score
-- Recalculates provider score + tier + loyalty after each confirmed job
-- ============================================================

CREATE OR REPLACE FUNCTION update_provider_score()
RETURNS TRIGGER AS $$
DECLARE
  v_avg       NUMERIC(3,2);
  v_jobs      INT;
  v_tier      reputation_tier;
BEGIN
  -- Only fires when confirmed_by_client flips to true
  IF NEW.confirmed_by_client = true AND OLD.confirmed_by_client = false THEN

    -- Recalculate rolling average score
    SELECT AVG(client_rating)
      INTO v_avg
      FROM jobs
     WHERE provider_id = NEW.provider_id
       AND client_rating IS NOT NULL;

    -- Increment lifetime_jobs
    UPDATE providers
       SET lifetime_jobs = lifetime_jobs + 1,
           score         = COALESCE(v_avg, 0),
           updated_at    = NOW()
     WHERE id = NEW.provider_id;

    -- Get updated lifetime_jobs for tier calc
    SELECT lifetime_jobs INTO v_jobs FROM providers WHERE id = NEW.provider_id;

    -- Calculate new tier
    v_tier := CASE
      WHEN v_jobs >= 100 THEN 'elite'
      WHEN v_jobs >= 50  THEN 'expert'
      WHEN v_jobs >= 25  THEN 'trusted'
      WHEN v_jobs >= 10  THEN 'rising'
      ELSE 'new'
    END;

    UPDATE providers SET reputation_tier = v_tier WHERE id = NEW.provider_id;

    -- Check loyalty milestones
    PERFORM check_loyalty_rewards(NEW.provider_id, v_jobs);

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_score
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_provider_score();

-- ============================================================
-- FUNCTION: check_loyalty_rewards
-- ============================================================

CREATE OR REPLACE FUNCTION check_loyalty_rewards(p_id UUID, p_jobs INT)
RETURNS VOID AS $$
BEGIN
  -- 10 jobs → 20% discount
  IF p_jobs = 10 THEN
    UPDATE providers SET loyalty_discount = 20 WHERE id = p_id;
    INSERT INTO loyalty_events (provider_id, event_type, jobs_at_event, reward_value)
      VALUES (p_id, 'discount_20', p_jobs, '20% off next renewal');
  END IF;

  -- 25 jobs → 30% discount + verified badge
  IF p_jobs = 25 THEN
    UPDATE providers SET loyalty_discount = 30, badge_verified = true WHERE id = p_id;
    INSERT INTO loyalty_events (provider_id, event_type, jobs_at_event, reward_value)
      VALUES (p_id, 'discount_30', p_jobs, '30% off + verified badge');
  END IF;

  -- 50 jobs → free month
  IF p_jobs = 50 THEN
    UPDATE providers SET free_months_earned = free_months_earned + 1 WHERE id = p_id;
    INSERT INTO loyalty_events (provider_id, event_type, jobs_at_event, reward_value)
      VALUES (p_id, 'free_month', p_jobs, '1 free subscription month');
  END IF;

  -- 100 jobs → elite status
  IF p_jobs = 100 THEN
    INSERT INTO loyalty_events (provider_id, event_type, jobs_at_event, reward_value)
      VALUES (p_id, 'elite_status', p_jobs, 'Elite status + homepage feature');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGER 2: trg_daily_analytics
-- Updates provider_analytics on every confirmed job
-- ============================================================

CREATE OR REPLACE FUNCTION update_daily_analytics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.confirmed_by_client = true AND OLD.confirmed_by_client = false THEN
    INSERT INTO provider_analytics (provider_id, date, jobs_done, bids_won)
      VALUES (NEW.provider_id, CURRENT_DATE, 1, 1)
    ON CONFLICT (provider_id, date)
      DO UPDATE SET
        jobs_done = provider_analytics.jobs_done + 1,
        bids_won  = provider_analytics.bids_won  + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_daily_analytics
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_analytics();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids               ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions      ENABLE ROW LEVEL SECURITY;

-- Users: read own profile
CREATE POLICY "users_select_own"   ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own"   ON users FOR UPDATE USING (auth.uid() = id);

-- Providers: public read (for browsing), own write
CREATE POLICY "providers_select_all"  ON providers FOR SELECT USING (true);
CREATE POLICY "providers_update_own"  ON providers FOR UPDATE USING (auth.uid() = id);

-- Requests: all can read open requests
CREATE POLICY "requests_select_open"  ON requests FOR SELECT USING (status = 'open' OR client_id = auth.uid());
CREATE POLICY "requests_insert_client" ON requests FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "requests_update_own"   ON requests FOR UPDATE USING (auth.uid() = client_id);

-- Bids: ONLY subscribed providers can insert
CREATE POLICY "bids_select_relevant"  ON bids FOR SELECT
  USING (provider_id = auth.uid() OR
         request_id IN (SELECT id FROM requests WHERE client_id = auth.uid()));
CREATE POLICY "bids_insert_subscribed" ON bids FOR INSERT
  WITH CHECK (
    auth.uid() = provider_id AND
    EXISTS (SELECT 1 FROM providers WHERE id = auth.uid() AND is_subscribed = true)
  );
CREATE POLICY "bids_update_own"       ON bids FOR UPDATE USING (auth.uid() = provider_id);

-- Jobs: only participants
CREATE POLICY "jobs_select_participants" ON jobs FOR SELECT
  USING (client_id = auth.uid() OR provider_id = auth.uid());
CREATE POLICY "jobs_update_client_confirm" ON jobs FOR UPDATE
  USING (client_id = auth.uid() OR provider_id = auth.uid());

-- Messages: only job participants
CREATE POLICY "messages_select_participants" ON messages FOR SELECT
  USING (
    job_id IN (SELECT id FROM jobs WHERE client_id = auth.uid() OR provider_id = auth.uid())
  );
CREATE POLICY "messages_insert_participants" ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    job_id IN (SELECT id FROM jobs WHERE client_id = auth.uid() OR provider_id = auth.uid())
  );

-- Analytics: provider-own only
CREATE POLICY "analytics_own" ON provider_analytics FOR SELECT USING (provider_id = auth.uid());

-- Loyalty events: provider-own only
CREATE POLICY "loyalty_own" ON loyalty_events FOR SELECT USING (provider_id = auth.uid());

-- Subscriptions: provider-own only
CREATE POLICY "subscriptions_own" ON subscriptions FOR SELECT USING (provider_id = auth.uid());

-- service_categories: public read
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON service_categories FOR SELECT USING (true);
