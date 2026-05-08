-- ============================================================
-- Migration 064: tier_lock
-- Protects admin-set reputation tiers from being auto-reset
-- by the update_provider_score() trigger on job completion.
-- ============================================================

-- 1. Add lock column
ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS tier_locked BOOLEAN NOT NULL DEFAULT false;

-- 2. Replace update_provider_score so it skips the tier
--    write when an admin has locked it manually.
CREATE OR REPLACE FUNCTION update_provider_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_jobs   INT;
  v_tier   reputation_tier;
  v_locked BOOLEAN;
BEGIN
  IF NEW.confirmed_by_client = TRUE AND OLD.confirmed_by_client = FALSE THEN

    IF NEW.client_rating IS NOT NULL THEN
      UPDATE providers
      SET
        lifetime_jobs = lifetime_jobs + 1,
        rating_sum    = rating_sum    + NEW.client_rating,
        rating_count  = rating_count  + 1,
        score         = (rating_sum + NEW.client_rating)::NUMERIC
                        / NULLIF(rating_count + 1, 0),
        updated_at    = NOW()
      WHERE id = NEW.provider_id;
    ELSE
      UPDATE providers
      SET
        lifetime_jobs = lifetime_jobs + 1,
        updated_at    = NOW()
      WHERE id = NEW.provider_id;
    END IF;

    SELECT lifetime_jobs, tier_locked
      INTO v_jobs, v_locked
    FROM providers
    WHERE id = NEW.provider_id;

    -- Only auto-update tier when NOT locked by an admin override
    IF NOT COALESCE(v_locked, false) THEN
      v_tier := CASE
        WHEN v_jobs >= 100 THEN 'elite'
        WHEN v_jobs >= 50  THEN 'expert'
        WHEN v_jobs >= 25  THEN 'trusted'
        WHEN v_jobs >= 10  THEN 'rising'
        ELSE                    'new'
      END;

      UPDATE providers
        SET reputation_tier = v_tier
      WHERE id = NEW.provider_id;
    END IF;

    PERFORM check_loyalty_rewards(NEW.provider_id, v_jobs);

  END IF;
  RETURN NEW;
END;
$$;
