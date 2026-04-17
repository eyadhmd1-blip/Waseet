-- ============================================================
-- WASEET — Smart Notifications System
-- v1.6 | April 2026
-- All 3 phases: Seasonal + Lifecycle + Behavioral + AI
-- ============================================================

-- ── Notification preferences (per user) ──────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id             UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled             BOOLEAN     NOT NULL DEFAULT true,
  seasonal            BOOLEAN     NOT NULL DEFAULT true,  -- موسمية
  lifecycle           BOOLEAN     NOT NULL DEFAULT true,  -- دورة حياة
  behavioral          BOOLEAN     NOT NULL DEFAULT true,  -- سلوكية
  win_back            BOOLEAN     NOT NULL DEFAULT true,  -- استعادة
  quiet_hour_start    SMALLINT    NOT NULL DEFAULT 22,    -- 10 PM
  quiet_hour_end      SMALLINT    NOT NULL DEFAULT 8,     -- 8 AM
  max_per_week        SMALLINT    NOT NULL DEFAULT 2,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_pref_own" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Notification log (prevent spam + track opens/conversions) ─
CREATE TABLE IF NOT EXISTS notification_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT        NOT NULL,  -- 'seasonal' | 'lifecycle' | 'behavioral' | 'win_back' | 'ai'
  template_key      TEXT        NOT NULL,  -- e.g. 'winter_ac', 'ramadan_clean', 'after_job_30d'
  title             TEXT        NOT NULL,
  body              TEXT        NOT NULL,
  data              JSONB       NOT NULL DEFAULT '{}',
  expo_ticket_id    TEXT,                  -- Expo receipt ID for delivery tracking
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at         TIMESTAMPTZ,           -- set via deep-link open tracking
  converted_at      TIMESTAMPTZ,           -- set when user submits a request after opening
  ab_variant        TEXT                   -- 'A' | 'B' for A/B testing
);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
-- Users can read their own log (for in-app notification center)
CREATE POLICY "notif_log_read_own" ON notification_log FOR SELECT
  USING (auth.uid() = user_id);
-- Engine writes via service role — no insert policy needed for authenticated

CREATE INDEX IF NOT EXISTS idx_notif_log_user_sent  ON notification_log(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_template    ON notification_log(user_id, template_key, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_type_sent   ON notification_log(notification_type, sent_at DESC);

-- ── User segments view (recomputed on each query) ────────────
-- Segment logic:
--   new:     registered < 14 days ago, 0 requests
--   active:  last request < 30 days ago
--   dormant: last request 30–90 days ago
--   churned: last request > 90 days ago OR registered > 30 days with 0 requests
CREATE OR REPLACE VIEW user_segments AS
SELECT
  u.id            AS user_id,
  u.role,
  u.city,
  u.created_at,
  COUNT(r.id)     AS total_requests,
  MAX(r.created_at) AS last_request_at,
  CASE
    WHEN COUNT(r.id) = 0 AND u.created_at > NOW() - INTERVAL '14 days'
      THEN 'new'
    WHEN COUNT(r.id) = 0 AND u.created_at < NOW() - INTERVAL '30 days'
      THEN 'churned'
    WHEN MAX(r.created_at) > NOW() - INTERVAL '30 days'
      THEN 'active'
    WHEN MAX(r.created_at) BETWEEN NOW() - INTERVAL '90 days' AND NOW() - INTERVAL '30 days'
      THEN 'dormant'
    ELSE 'churned'
  END             AS segment,
  -- Most used category (for personalisation)
  (
    SELECT category_slug FROM requests
    WHERE client_id = u.id
    GROUP BY category_slug
    ORDER BY COUNT(*) DESC LIMIT 1
  )               AS top_category,
  -- Days since last notification sent to this user
  (
    SELECT EXTRACT(EPOCH FROM (NOW() - MAX(sent_at))) / 86400
    FROM notification_log
    WHERE user_id = u.id
  )               AS days_since_last_notif
FROM users u
LEFT JOIN requests r ON r.client_id = u.id
WHERE u.role = 'client'
GROUP BY u.id, u.role, u.city, u.created_at;

-- ── Helper: mark notification opened ─────────────────────────
CREATE OR REPLACE FUNCTION mark_notification_opened(notif_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE notification_log
  SET opened_at = NOW()
  WHERE id = notif_id AND opened_at IS NULL;
END;
$$;

-- ── Helper: mark notification converted ──────────────────────
CREATE OR REPLACE FUNCTION mark_notification_converted(notif_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE notification_log
  SET converted_at = NOW()
  WHERE id = notif_id AND converted_at IS NULL;
END;
$$;

-- ── Auto-create preferences row on user insert ────────────────
CREATE OR REPLACE FUNCTION create_notification_preferences()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_notif_prefs
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_notification_preferences();
