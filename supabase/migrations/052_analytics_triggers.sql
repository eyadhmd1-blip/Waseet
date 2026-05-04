-- ============================================================
-- Migration 052: Populate provider_analytics fully
--
-- Previously only jobs_done + bids_won were written.
-- This migration adds:
--   1. earnings_est — updated when a job is confirmed
--   2. bids_placed  — updated when a provider submits a bid
--   3. views        — updated when increment_profile_view() runs
-- ============================================================

-- ── 1. update_daily_analytics: add earnings_est ───────────────
-- Replaces the version from migration 025.
-- Gets the bid amount via jobs.bid_id → bids.amount.

CREATE OR REPLACE FUNCTION update_daily_analytics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_amount NUMERIC(10,2) := 0;
BEGIN
  IF NEW.confirmed_by_client = true AND OLD.confirmed_by_client = false THEN
    -- Fetch winning bid amount for earnings estimate
    SELECT COALESCE(b.amount, 0)
      INTO v_amount
      FROM bids b
      WHERE b.id = NEW.bid_id;

    INSERT INTO provider_analytics (provider_id, date, jobs_done, bids_won, earnings_est)
      VALUES (NEW.provider_id, CURRENT_DATE, 1, 1, v_amount)
    ON CONFLICT (provider_id, date)
      DO UPDATE SET
        jobs_done    = provider_analytics.jobs_done    + 1,
        bids_won     = provider_analytics.bids_won     + 1,
        earnings_est = provider_analytics.earnings_est + v_amount;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 2. record_bid_placed: new trigger on bids INSERT ─────────

CREATE OR REPLACE FUNCTION record_bid_placed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO provider_analytics (provider_id, date, bids_placed)
    VALUES (NEW.provider_id, CURRENT_DATE, 1)
  ON CONFLICT (provider_id, date)
    DO UPDATE SET bids_placed = provider_analytics.bids_placed + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_bid_placed ON bids;
CREATE TRIGGER trg_record_bid_placed
  AFTER INSERT ON bids
  FOR EACH ROW EXECUTE FUNCTION record_bid_placed();

-- ── 3. increment_profile_view: also write to analytics ────────
-- Replaces the version from migrations 011 / 025.

CREATE OR REPLACE FUNCTION increment_profile_view(p_provider_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE providers SET profile_views = profile_views + 1 WHERE id = p_provider_id;

  INSERT INTO provider_analytics (provider_id, date, views)
    VALUES (p_provider_id, CURRENT_DATE, 1)
  ON CONFLICT (provider_id, date)
    DO UPDATE SET views = provider_analytics.views + 1;
END;
$$;
