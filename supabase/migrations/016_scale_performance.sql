-- ============================================================
-- Migration 016: Scale Performance Fixes
-- Targets 1,000,000-user readiness.
--
-- Changes:
--   1. Incremental provider score calculation  (O(1) vs O(n))
--   2. Composite partial index on requests     (provider feed)
--   3. GIN index on providers.categories      (urgent routing)
--   4. RLS policy rewrites: IN → EXISTS        (eliminates
--      correlated subquery per row scanned)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. INCREMENTAL PROVIDER SCORE
--    Replace full AVG() scan with running sum + count.
-- ────────────────────────────────────────────────────────────

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS rating_sum   BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count INT    NOT NULL DEFAULT 0;

-- Back-fill from existing confirmed jobs (safe to re-run)
UPDATE providers p
SET
  rating_sum   = COALESCE(s.rsum,   0),
  rating_count = COALESCE(s.rcount, 0)
FROM (
  SELECT
    provider_id,
    SUM(client_rating) AS rsum,
    COUNT(*)           AS rcount
  FROM jobs
  WHERE client_rating IS NOT NULL
    AND confirmed_by_client = TRUE
  GROUP BY provider_id
) s
WHERE p.id = s.provider_id;

-- Rewrite trigger: O(1) per confirmation, no historical scan
CREATE OR REPLACE FUNCTION update_provider_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_jobs INT;
  v_tier reputation_tier;
BEGIN
  -- Only fires when confirmed_by_client flips TRUE
  IF NEW.confirmed_by_client = TRUE AND OLD.confirmed_by_client = FALSE THEN

    IF NEW.client_rating IS NOT NULL THEN
      -- Increment sum + count, recompute score in a single UPDATE
      -- PostgreSQL evaluates SET expressions against pre-update values,
      -- so (rating_sum + NEW.client_rating) uses the OLD sum. Correct.
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
      -- Job confirmed but client left no rating — only bump job count
      UPDATE providers
      SET
        lifetime_jobs = lifetime_jobs + 1,
        updated_at    = NOW()
      WHERE id = NEW.provider_id;
    END IF;

    -- Read updated lifetime_jobs for tier + loyalty checks
    SELECT lifetime_jobs INTO v_jobs
    FROM providers
    WHERE id = NEW.provider_id;

    v_tier := CASE
      WHEN v_jobs >= 100 THEN 'elite'
      WHEN v_jobs >= 50  THEN 'expert'
      WHEN v_jobs >= 25  THEN 'trusted'
      WHEN v_jobs >= 10  THEN 'rising'
      ELSE 'new'
    END;

    UPDATE providers
    SET reputation_tier = v_tier
    WHERE id = NEW.provider_id;

    PERFORM check_loyalty_rewards(NEW.provider_id, v_jobs);

  END IF;
  RETURN NEW;
END;
$$;
-- Trigger definition unchanged — just the function body changed above

-- ────────────────────────────────────────────────────────────
-- 2. COMPOSITE PARTIAL INDEX — provider feed query
--    Covers: WHERE status='open' AND city=? AND category_slug=?
--            ORDER BY created_at DESC
--    Without this, PostgreSQL must merge three single-column
--    indexes via bitmap AND — expensive at 1M+ requests.
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_requests_feed
  ON requests (city, category_slug, created_at DESC)
  WHERE status = 'open';

-- ────────────────────────────────────────────────────────────
-- 3. GIN INDEX — providers.categories array
--    Enables "= ANY(categories)" to use an index scan instead
--    of a sequential scan. Required for urgent routing RPC
--    (get_available_providers_for_urgent) at 100k+ providers.
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_providers_categories_gin
  ON providers USING GIN (categories);

-- ────────────────────────────────────────────────────────────
-- 4. RLS POLICY REWRITES — EXISTS replaces IN (subquery)
--
--    IN (SELECT id FROM …) re-evaluates the subquery for every
--    row scanned, even with indexes. EXISTS short-circuits on
--    the first matching row and uses a nested-loop join, which
--    PostgreSQL optimises far better at scale.
-- ────────────────────────────────────────────────────────────

-- 4a. messages — SELECT
DROP POLICY IF EXISTS "messages_select_participants" ON messages;
CREATE POLICY "messages_select_participants" ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = messages.job_id
        AND (jobs.client_id = auth.uid() OR jobs.provider_id = auth.uid())
    )
  );

-- 4b. messages — INSERT
DROP POLICY IF EXISTS "messages_insert_participants" ON messages;
CREATE POLICY "messages_insert_participants" ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = messages.job_id
        AND (jobs.client_id = auth.uid() OR jobs.provider_id = auth.uid())
    )
  );

-- 4c. bids — SELECT
DROP POLICY IF EXISTS "bids_select_relevant" ON bids;
CREATE POLICY "bids_select_relevant" ON bids
  FOR SELECT
  USING (
    provider_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = bids.request_id
        AND requests.client_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- Verification queries (run after migration to confirm):
--
--   -- Check new columns exist
--   SELECT id, rating_sum, rating_count, score
--   FROM providers LIMIT 10;
--
--   -- Check new indexes
--   SELECT indexname FROM pg_indexes
--   WHERE tablename IN ('requests','providers')
--     AND indexname IN (
--       'idx_requests_feed',
--       'idx_providers_categories_gin'
--     );
--
--   -- Check updated policies
--   SELECT policyname, cmd, qual
--   FROM pg_policies
--   WHERE tablename IN ('messages','bids');
-- ────────────────────────────────────────────────────────────
