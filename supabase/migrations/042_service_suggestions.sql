-- ============================================================
-- Migration 042: Service Suggestions
--
-- Users can suggest a service they couldn't find in the category
-- picker ("لم تجد خدمتك؟"). Admins review in the admin panel and
-- approve/reject. On approval a notification is inserted for the
-- user so they are informed when their suggestion goes live.
-- ============================================================

-- ── 1. Table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_suggestions (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_name  TEXT         NOT NULL,
  category_hint TEXT,          -- optional: user's guess at which group
  status        TEXT         NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note    TEXT,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ,
  reviewed_by   TEXT           -- admin identifier
);

-- ── 2. RLS ────────────────────────────────────────────────────

ALTER TABLE service_suggestions ENABLE ROW LEVEL SECURITY;

-- Users can submit suggestions
CREATE POLICY "suggestions_insert_own"
  ON service_suggestions FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users can view their own suggestions (to track status)
CREATE POLICY "suggestions_select_own"
  ON service_suggestions FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- ── 3. Indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_suggestions_status
  ON service_suggestions (status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_suggestions_user
  ON service_suggestions (user_id, created_at DESC);

-- ── 4. Trigger: insert in-app notification on approval ────────

CREATE OR REPLACE FUNCTION notify_suggestion_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    INSERT INTO notifications (
      user_id,
      title,
      body,
      notification_type,
      data
    ) VALUES (
      NEW.user_id,
      '✅ تمت إضافة خدمتك!',
      'تمت إضافة "' || NEW.service_name || '" إلى قائمة الخدمات. يمكنك الآن طلبها أو تقديم عروض عليها.',
      'suggestion_approved',
      jsonb_build_object('screen', 'new_request', 'service', NEW.service_name)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_suggestion_approved
  AFTER UPDATE OF status ON service_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION notify_suggestion_approved();
