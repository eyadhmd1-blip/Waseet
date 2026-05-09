-- ============================================================
-- Migration 072: fix_late_rating_score
-- Problem: update_provider_score() only fires when
--   confirmed_by_client flips FALSE→TRUE. But client_rating is
--   saved later (rate-job screen) as a separate UPDATE, so the
--   trigger condition is never true again → score stays 0.
-- Fix: add a second ELSIF branch that fires when client_rating
--   is set on an already-confirmed job.
-- ============================================================

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

  -- ── Branch A: job confirmed (may or may not have a rating yet) ──
  IF NEW.confirmed_by_client = TRUE AND OLD.confirmed_by_client = FALSE THEN

    IF NEW.client_rating IS NOT NULL THEN
      UPDATE providers SET
        lifetime_jobs = lifetime_jobs + 1,
        rating_sum    = rating_sum    + NEW.client_rating,
        rating_count  = rating_count  + 1,
        score         = (rating_sum + NEW.client_rating)::NUMERIC
                        / NULLIF(rating_count + 1, 0),
        updated_at    = NOW()
      WHERE id = NEW.provider_id;
    ELSE
      -- Job confirmed but rating not submitted yet — just count the job
      UPDATE providers SET
        lifetime_jobs = lifetime_jobs + 1,
        updated_at    = NOW()
      WHERE id = NEW.provider_id;
    END IF;

    SELECT lifetime_jobs, tier_locked
      INTO v_jobs, v_locked
    FROM providers WHERE id = NEW.provider_id;

    IF NOT COALESCE(v_locked, false) THEN
      v_tier := CASE
        WHEN v_jobs >= 100 THEN 'elite'
        WHEN v_jobs >= 50  THEN 'expert'
        WHEN v_jobs >= 25  THEN 'trusted'
        WHEN v_jobs >= 10  THEN 'rising'
        ELSE                    'new'
      END;
      UPDATE providers SET reputation_tier = v_tier WHERE id = NEW.provider_id;
    END IF;

    PERFORM check_loyalty_rewards(NEW.provider_id, v_jobs);

  -- ── Branch B: rating submitted after confirmation (the common case) ──
  ELSIF NEW.confirmed_by_client = TRUE
    AND OLD.client_rating IS NULL
    AND NEW.client_rating IS NOT NULL
  THEN
    UPDATE providers SET
      rating_sum   = rating_sum   + NEW.client_rating,
      rating_count = rating_count + 1,
      score        = (rating_sum + NEW.client_rating)::NUMERIC
                     / NULLIF(rating_count + 1, 0),
      updated_at   = NOW()
    WHERE id = NEW.provider_id;

  END IF;

  RETURN NEW;
END;
$$;

-- ── Backfill: fix providers whose score is 0 but have ratings ──
-- Recalculates score, rating_sum, rating_count from actual job data.
WITH stats AS (
  SELECT
    provider_id,
    COUNT(*)              AS rc,
    SUM(client_rating)    AS rs,
    AVG(client_rating)    AS avg
  FROM jobs
  WHERE confirmed_by_client = TRUE
    AND client_rating IS NOT NULL
  GROUP BY provider_id
)
UPDATE providers p
SET
  rating_count = s.rc,
  rating_sum   = s.rs,
  score        = ROUND(s.avg::NUMERIC, 2),
  updated_at   = NOW()
FROM stats s
WHERE p.id = s.provider_id
  AND p.score = 0;
