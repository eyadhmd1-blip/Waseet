-- ============================================================
-- Migration 089: Notify provider when admin replies to support ticket
-- ============================================================
-- Inserts an in-app notification row whenever a real admin message
-- is added to a support ticket (sender_id IS NOT NULL guards against
-- the auto-welcome bot message inserted at ticket creation time).
-- Push notification is handled by the mobile admin client (support-thread.tsx).
-- ============================================================

CREATE OR REPLACE FUNCTION _trg_notify_user_support_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_lang    text;
BEGIN
  -- Only fire for real admin replies; skip bot/auto messages (sender_id IS NULL)
  IF NEW.is_admin = false OR NEW.sender_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_user_id
  FROM support_tickets
  WHERE id = NEW.ticket_id;

  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  -- Don't notify the admin themselves (edge case: admin views own ticket)
  IF v_user_id = NEW.sender_id THEN RETURN NEW; END IF;

  SELECT COALESCE(lang, 'ar') INTO v_lang
  FROM users WHERE id = v_user_id;

  INSERT INTO notifications (user_id, title, body, type, screen, metadata)
  VALUES (
    v_user_id,
    CASE WHEN v_lang = 'ar' THEN '📨 رد جديد من الدعم' ELSE '📨 New reply from support' END,
    CASE WHEN v_lang = 'ar' THEN 'فريق وسيط أرسل لك رسالة — اضغط للاطلاع'
                             ELSE 'Waseet team sent you a message — tap to view' END,
    'support_reply',
    'support_thread',
    jsonb_build_object('ticket_id', NEW.ticket_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_user_support_reply ON support_messages;
CREATE TRIGGER trg_notify_user_support_reply
  AFTER INSERT ON support_messages
  FOR EACH ROW
  EXECUTE FUNCTION _trg_notify_user_support_reply();
