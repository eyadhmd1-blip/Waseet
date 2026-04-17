-- ══════════════════════════════════════════════════════════════
-- Migration 013 — Admin Panel Infrastructure
-- Adds: admin columns, provider suspension, audit log,
--       platform settings, daily stats cache
-- ══════════════════════════════════════════════════════════════

-- ── 1. Admin fields on users ──────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_disabled      boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_at      timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_reason  text,
  ADD COLUMN IF NOT EXISTS is_admin         boolean      NOT NULL DEFAULT false;

-- ── 2. Provider-specific suspension (keeps user account active) ─

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS is_active         boolean      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS suspended_at      timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text;

-- ── 3. Admin audit log ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  action        text         NOT NULL,        -- 'disable_user', 'verify_provider', etc.
  target_type   text         NOT NULL,        -- 'user' | 'provider' | 'request' | 'contract' | 'system'
  target_id     uuid,
  target_label  text,                          -- human-readable name for display
  reason        text,
  metadata      jsonb        NOT NULL DEFAULT '{}',
  created_at    timestamptz  NOT NULL DEFAULT now()
);

-- No RLS policies → only service-role key can access (admin client)
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_log_created    ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target     ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON admin_audit_log(action);

-- ── 4. Platform settings (key/value store) ────────────────────

CREATE TABLE IF NOT EXISTS platform_settings (
  key         text         PRIMARY KEY,
  value       text         NOT NULL,
  label       text         NOT NULL,
  description text,
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
-- No policies → service-role only

-- Seed default settings
INSERT INTO platform_settings (key, value, label, description) VALUES
  ('urgent_premium_percent',   '25',    'نسبة رسوم الطلب الطارئ (%)', 'النسبة المضافة على سعر الطلب الطارئ'),
  ('urgent_window_minutes',    '60',    'نافذة الطلب الطارئ (دقيقة)', 'المدة الزمنية لاستجابة مزود الطلب الطارئ'),
  ('max_bids_per_request',     '15',    'الحد الأقصى للعروض لكل طلب', 'عدد العروض المسموح به على كل طلب'),
  ('request_auto_close_days',  '14',    'إغلاق الطلبات تلقائياً بعد (يوم)', 'إغلاق الطلبات المفتوحة بعد هذه المدة بدون عروض'),
  ('min_bid_jod',              '3',     'الحد الأدنى للعرض (دينار)', 'أقل مبلغ مسموح به في أي عرض'),
  ('maintenance_mode',         'false', 'وضع الصيانة', 'عند التفعيل يمنع المستخدمين من الدخول'),
  ('platform_commission_pct',  '0',     'عمولة المنصة (%)', 'النسبة المحتجزة من كل صفقة (مستقبلياً)')
ON CONFLICT (key) DO NOTHING;

-- ── 5. Daily platform stats cache ─────────────────────────────

CREATE TABLE IF NOT EXISTS platform_stats_daily (
  date                 date         PRIMARY KEY,
  new_clients          int          NOT NULL DEFAULT 0,
  new_providers        int          NOT NULL DEFAULT 0,
  requests_posted      int          NOT NULL DEFAULT 0,
  requests_completed   int          NOT NULL DEFAULT 0,
  urgent_requests      int          NOT NULL DEFAULT 0,
  contract_requests    int          NOT NULL DEFAULT 0,
  active_subscriptions int          NOT NULL DEFAULT 0,
  created_at           timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE platform_stats_daily ENABLE ROW LEVEL SECURITY;

-- ── 6. Useful indexes for admin queries ───────────────────────

CREATE INDEX IF NOT EXISTS idx_users_disabled    ON users(is_disabled)  WHERE is_disabled = true;
CREATE INDEX IF NOT EXISTS idx_users_is_admin    ON users(is_admin)     WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_providers_active  ON providers(is_active) WHERE is_active = false;
CREATE INDEX IF NOT EXISTS idx_users_created_at  ON users(created_at DESC);
