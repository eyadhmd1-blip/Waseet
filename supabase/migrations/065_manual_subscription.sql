-- ============================================================
-- Migration 065: Manual Subscription Activation
--
-- 1. manual_payments — audit table for offline (cash/bank) payments
-- 2. expire_subscriptions() — daily sweep that deactivates providers
--    whose subscription_ends has passed (no Paddle event covers this
--    for manually activated subscriptions)
-- 3. pg_cron job at 04:00 UTC — runs before notify-subscription-expiry
--    at 05:00 UTC so the notification function sees accurate is_subscribed=false rows
-- ============================================================

-- ── 1. Manual payments audit table ───────────────────────────

CREATE TABLE IF NOT EXISTS manual_payments (
  id             UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id    UUID              NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  tier           subscription_tier NOT NULL,
  period_months  INT               NOT NULL DEFAULT 1,
  amount_jod     NUMERIC(8,3)      NOT NULL DEFAULT 0,
  payment_method TEXT              NOT NULL DEFAULT 'cash',  -- cash | bank_transfer | other
  payment_ref    TEXT              NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

ALTER TABLE manual_payments ENABLE ROW LEVEL SECURITY;
-- Providers and clients have no access; service_role (admin) bypasses RLS
DROP POLICY IF EXISTS "manual_payments_no_access" ON manual_payments;
CREATE POLICY "manual_payments_no_access"
  ON manual_payments FOR ALL TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_manual_payments_provider
  ON manual_payments (provider_id, created_at DESC);

-- ── 2. expire_subscriptions() ─────────────────────────────────
-- Flips is_subscribed = false and zeroes subscription_credits for
-- every provider whose subscription_ends has passed.
-- Returns the number of rows updated (for cron monitoring).

CREATE OR REPLACE FUNCTION expire_subscriptions()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE providers
  SET
    is_subscribed        = false,
    subscription_credits = 0,
    updated_at           = NOW()
  WHERE is_subscribed    = true
    AND subscription_ends IS NOT NULL
    AND subscription_ends < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── 3. Register daily cron at 04:00 UTC ──────────────────────
-- Runs 1 hour before notify-subscription-expiry (05:00 UTC) so
-- the notification function's justExpired query sees the correct rows.

DO $$ BEGIN PERFORM cron.unschedule('expire-subscriptions'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'expire-subscriptions',
  '0 4 * * *',
  'SELECT expire_subscriptions()'
);
