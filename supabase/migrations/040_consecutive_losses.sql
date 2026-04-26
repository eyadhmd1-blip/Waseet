-- ============================================================
-- Migration 040: Consecutive Loss Tracking + Perseverance Reward
--
-- Tracks how many bids a provider has lost in a row without a win.
-- Every 7 consecutive losses: award +1 bid credit (non-premium).
-- Resets to 0 on any bid win.
--
-- The edge function (notify-providers-bid-rejected) reads this
-- counter to personalise the rejection push notification.
-- ============================================================

-- ── 1. Add column ─────────────────────────────────────────────

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS consecutive_losses INT NOT NULL DEFAULT 0;

-- ── 2. Update track_bid_rejection to also handle the counter ──
--
-- The existing trigger already fires AFTER UPDATE OF status ON bids.
-- We extend it to:
--   a) increment consecutive_losses on rejection
--   b) award +1 credit every 7 losses (non-premium, cap at lifetime)
--   c) reset to 0 on a win (bid accepted)
-- ============================================================

CREATE OR REPLACE FUNCTION track_bid_rejection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total    INT;
  v_rejected INT;
  v_rate     NUMERIC(4,3);
  v_losses   INT;
  v_tier     subscription_tier;
BEGIN

  -- ── A. Handle rejection ─────────────────────────────────────
  IF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN

    -- Stamp rejected_at
    UPDATE bids
    SET    rejected_at = NOW()
    WHERE  id          = NEW.id
      AND  rejected_at IS NULL;

    -- Recalculate 30-day rejection rate
    SELECT
      COUNT(*) FILTER (WHERE status IN ('accepted', 'rejected')),
      COUNT(*) FILTER (WHERE status = 'rejected')
    INTO v_total, v_rejected
    FROM bids
    WHERE provider_id = NEW.provider_id
      AND created_at  > NOW() - INTERVAL '30 days';

    IF v_total > 0 THEN
      v_rate := ROUND(v_rejected::NUMERIC / v_total, 3);
    ELSE
      v_rate := 0.000;
    END IF;

    -- Increment consecutive_losses, get updated value + tier
    UPDATE providers
    SET    bid_rejection_rate = v_rate,
           consecutive_losses = consecutive_losses + 1
    WHERE  id = NEW.provider_id
    RETURNING consecutive_losses, subscription_tier
    INTO   v_losses, v_tier;

    -- Perseverance reward: every 7 consecutive losses → +1 credit
    -- (non-premium only; premium is unlimited)
    IF v_losses % 7 = 0 THEN
      IF v_tier <> 'premium' THEN
        UPDATE providers
        SET    bid_credits = bid_credits + 1
        WHERE  id = NEW.provider_id;
      END IF;
    END IF;

  END IF;

  -- ── B. Handle win — reset streak ────────────────────────────
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    UPDATE providers
    SET    consecutive_losses = 0
    WHERE  id = NEW.provider_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger already exists from migration 019 — recreate to pick up new function
DROP TRIGGER IF EXISTS trg_track_bid_rejection ON bids;
CREATE TRIGGER trg_track_bid_rejection
  AFTER UPDATE OF status ON bids
  FOR EACH ROW
  EXECUTE FUNCTION track_bid_rejection();

-- ── 3. Index for provider lookups in edge function ────────────
CREATE INDEX IF NOT EXISTS idx_providers_consecutive_losses
  ON providers (consecutive_losses)
  WHERE consecutive_losses > 0;
