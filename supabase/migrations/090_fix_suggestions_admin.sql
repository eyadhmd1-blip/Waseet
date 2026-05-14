-- ============================================================
-- Migration 090: Fix service_suggestions for Admin
--
-- 1. Fix notify_suggestion_approved trigger: wrong column names
--    (notification_type → type, data → metadata)
-- 2. Add RLS policies so admin can SELECT all and UPDATE status
-- ============================================================

-- ── 1. Fix trigger: correct column names ─────────────────────

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
      type,
      metadata
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

-- ── 2. Admin RLS: SELECT all suggestions ─────────────────────

DO $$ BEGIN
  CREATE POLICY "suggestions_admin_select"
    ON service_suggestions FOR SELECT
    USING ((SELECT is_admin FROM users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. Admin RLS: UPDATE status (approve / reject) ───────────

DO $$ BEGIN
  CREATE POLICY "suggestions_admin_update"
    ON service_suggestions FOR UPDATE
    USING ((SELECT is_admin FROM users WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
