-- ============================================================
-- WASEET — Migration 032 | CliQ Payment Tickets
-- Adds plan metadata to support_tickets, admin RLS policies,
-- and admin_activate_subscription RPC.
-- ============================================================

-- 1. Add payment metadata columns to support_tickets
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS plan_tier        text,
  ADD COLUMN IF NOT EXISTS plan_amount_jod  numeric(6,2);

-- 2. Admin RLS: admins can read and write all support tickets
DROP POLICY IF EXISTS "admin_all_tickets" ON support_tickets;
CREATE POLICY "admin_all_tickets" ON support_tickets
  FOR ALL
  USING     (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

-- 3. Admin RLS: admins can read and write all support messages
DROP POLICY IF EXISTS "admin_all_messages" ON support_messages;
CREATE POLICY "admin_all_messages" ON support_messages
  FOR ALL
  USING     (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

-- 4. RPC: admin_activate_subscription
--    Called from the admin panel after verifying a CliQ transfer.
--    Guards that caller is admin, activates the subscription,
--    resolves the ticket, and posts a confirmation message.
CREATE OR REPLACE FUNCTION admin_activate_subscription(
  p_ticket_id   uuid,
  p_provider_id uuid,
  p_tier        text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Guard: caller must be an admin
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  -- Activate subscription (resets credits, win_discount, loyalty_discount)
  PERFORM activate_provider_subscription(
    p_provider_id   := p_provider_id,
    p_tier          := p_tier,
    p_period_months := 1
  );

  -- Resolve the ticket
  UPDATE support_tickets
  SET    status      = 'resolved',
         resolved_at = now(),
         updated_at  = now()
  WHERE  id = p_ticket_id;

  -- Post a confirmation message visible to the provider
  INSERT INTO support_messages (ticket_id, sender_id, is_admin, body)
  VALUES (
    p_ticket_id,
    auth.uid(),
    true,
    '✅ تم تأكيد دفعتك وتفعيل اشتراكك بنجاح! يمكنك الآن تقديم عروضك على الطلبات. شكراً لك.'
  );
END;
$$;
