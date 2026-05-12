-- ============================================================
-- Migration 083: Provider Automatic Flagging System
-- ============================================================
-- Adds automatic monitoring for provider quality issues.
-- Flags are created by DB triggers and a cron job — no mobile
-- app changes required.
--
-- Triggers:
--   1. low_rating      → when client_rating is set on a job
--   2. high_rejection  → when a bid status changes to 'rejected'
--   3. complaints      → when a report is filed against a provider
--   4. job_abandonment → hourly cron: active jobs > 72h with no confirmation
--
-- Admin resolves each flag with: 'warned' | 'suspended' | 'cleared'
-- ============================================================

-- ─── 1. Add flag columns to providers ────────────────────────

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS is_flagged  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_count  INTEGER NOT NULL DEFAULT 0;

-- ─── 2. provider_flags table ─────────────────────────────────

CREATE TABLE IF NOT EXISTS provider_flags (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id  UUID        NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  reason       TEXT        NOT NULL,   -- 'low_rating' | 'high_rejection' | 'complaints' | 'job_abandonment'
  details      JSONB       NOT NULL DEFAULT '{}',
  reviewed     BOOLEAN     NOT NULL DEFAULT false,
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  TEXT,
  action_taken TEXT,                   -- 'warned' | 'suspended' | 'cleared'
  admin_note   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_flags_provider
  ON provider_flags (provider_id);

CREATE INDEX IF NOT EXISTS idx_provider_flags_unreviewed
  ON provider_flags (created_at DESC)
  WHERE reviewed = false;

ALTER TABLE provider_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "flags_no_direct_access" ON provider_flags;
CREATE POLICY "flags_no_direct_access" ON provider_flags USING (false);

-- ─── 3. flag_provider ────────────────────────────────────────
-- Creates one flag record per (provider, reason).
-- Skips if an identical unreviewed flag already exists.

CREATE OR REPLACE FUNCTION flag_provider(
  p_provider_id UUID,
  p_reason      TEXT,
  p_details     JSONB DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Avoid duplicate unreviewed flags for the same reason
  IF EXISTS (
    SELECT 1 FROM provider_flags
    WHERE provider_id = p_provider_id
      AND reason      = p_reason
      AND reviewed    = false
  ) THEN
    RETURN;
  END IF;

  INSERT INTO provider_flags (provider_id, reason, details)
  VALUES (p_provider_id, p_reason, p_details);

  UPDATE providers
  SET is_flagged = true,
      flag_count = flag_count + 1
  WHERE id = p_provider_id;
END;
$$;

-- ─── 4. check_and_flag_provider ──────────────────────────────
-- Evaluates all three real-time conditions for a given provider.
-- Called by DB triggers after rating / bid rejection / report.

CREATE OR REPLACE FUNCTION check_and_flag_provider(p_provider_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg_rating      NUMERIC;
  v_rated_count     INTEGER;
  v_reject_rate     NUMERIC;
  v_decided_bids    INTEGER;
  v_complaint_count INTEGER;
BEGIN
  -- Guard: provider must exist
  IF NOT EXISTS (SELECT 1 FROM providers WHERE id = p_provider_id) THEN
    RETURN;
  END IF;

  -- ── Condition 1: Low rating ───────────────────────────────
  -- avg client_rating on completed jobs < 2.5, minimum 2 rated jobs
  SELECT
    AVG(client_rating::NUMERIC),
    COUNT(client_rating)
  INTO v_avg_rating, v_rated_count
  FROM jobs
  WHERE provider_id  = p_provider_id
    AND client_rating IS NOT NULL;

  IF v_rated_count >= 2 AND v_avg_rating < 2.5 THEN
    PERFORM flag_provider(
      p_provider_id,
      'low_rating',
      jsonb_build_object(
        'avg_rating',  ROUND(v_avg_rating, 2),
        'rated_jobs',  v_rated_count
      )
    );
  END IF;

  -- ── Condition 2: High rejection rate ─────────────────────
  -- rejected / (rejected + accepted + withdrawn) > 60%, min 5 decided
  SELECT
    COUNT(*) FILTER (WHERE status = 'rejected') * 1.0
      / NULLIF(COUNT(*) FILTER (WHERE status IN ('rejected','accepted','withdrawn')), 0),
    COUNT(*) FILTER (WHERE status IN ('rejected','accepted','withdrawn'))
  INTO v_reject_rate, v_decided_bids
  FROM bids
  WHERE provider_id = p_provider_id;

  IF v_decided_bids >= 5 AND COALESCE(v_reject_rate, 0) > 0.60 THEN
    PERFORM flag_provider(
      p_provider_id,
      'high_rejection',
      jsonb_build_object(
        'rejection_rate_pct', ROUND(v_reject_rate * 100, 1),
        'total_decided_bids', v_decided_bids
      )
    );
  END IF;

  -- ── Condition 3: Multiple complaints ─────────────────────
  -- 3+ reports from distinct clients
  SELECT COUNT(DISTINCT reporter_id)
  INTO v_complaint_count
  FROM reports
  WHERE reported_user_id = p_provider_id;

  IF v_complaint_count >= 3 THEN
    PERFORM flag_provider(
      p_provider_id,
      'complaints',
      jsonb_build_object('distinct_reporters', v_complaint_count)
    );
  END IF;

END;
$$;

-- ─── 5. resolve_provider_flag ────────────────────────────────
-- Called by admin portal server action.
-- Returns the provider_id so the caller can apply further actions.

CREATE OR REPLACE FUNCTION resolve_provider_flag(
  p_flag_id    UUID,
  p_action     TEXT,
  p_admin_note TEXT,
  p_admin_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id   UUID;
  v_still_flagged BOOLEAN;
BEGIN
  SELECT provider_id INTO v_provider_id
  FROM provider_flags WHERE id = p_flag_id;

  IF NOT FOUND THEN RETURN NULL; END IF;

  UPDATE provider_flags
  SET reviewed     = true,
      reviewed_at  = now(),
      reviewed_by  = p_admin_name,
      action_taken = p_action,
      admin_note   = p_admin_note
  WHERE id = p_flag_id;

  -- Recalculate is_flagged: still flagged if other unreviewed flags remain
  SELECT EXISTS (
    SELECT 1 FROM provider_flags
    WHERE provider_id = v_provider_id
      AND reviewed    = false
  ) INTO v_still_flagged;

  UPDATE providers
  SET is_flagged = v_still_flagged
  WHERE id = v_provider_id;

  RETURN v_provider_id;
END;
$$;

-- ─── 6. get_unreviewed_flags_count ───────────────────────────
-- Used by admin portal sidebar badge.

CREATE OR REPLACE FUNCTION get_unreviewed_flags_count()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM provider_flags WHERE reviewed = false;
$$;

-- ─── 7. check_job_abandonment (cron target) ──────────────────
-- Flags providers with active jobs > 72 hours and no confirmation.
-- Per-job deduplication via details->>'job_id'.

CREATE OR REPLACE FUNCTION check_job_abandonment()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (provider_id) provider_id, id AS job_id
    FROM jobs
    WHERE status       = 'active'
      AND created_at   < now() - INTERVAL '72 hours'
      AND confirmed_at IS NULL
    ORDER BY provider_id, created_at
  LOOP
    -- Skip if this exact job is already flagged
    IF NOT EXISTS (
      SELECT 1 FROM provider_flags
      WHERE provider_id = r.provider_id
        AND reason      = 'job_abandonment'
        AND (details->>'job_id') = r.job_id::TEXT
    ) THEN
      PERFORM flag_provider(
        r.provider_id,
        'job_abandonment',
        jsonb_build_object(
          'job_id',      r.job_id,
          'detected_at', now()
        )
      );
    END IF;
  END LOOP;
END;
$$;

-- ─── 8. DB Triggers ──────────────────────────────────────────

-- Trigger A: low rating — fires when client_rating is set on a job
CREATE OR REPLACE FUNCTION _trg_flag_on_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_rating IS NOT NULL
     AND NEW.client_rating IS DISTINCT FROM OLD.client_rating
  THEN
    PERFORM check_and_flag_provider(NEW.provider_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flag_on_rating ON jobs;
CREATE TRIGGER trg_flag_on_rating
  AFTER UPDATE OF client_rating ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION _trg_flag_on_rating();

-- Trigger B: high rejection — fires when a bid is rejected
CREATE OR REPLACE FUNCTION _trg_flag_on_bid_rejected()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'rejected'
     AND OLD.status IS DISTINCT FROM 'rejected'
  THEN
    PERFORM check_and_flag_provider(NEW.provider_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flag_on_bid_rejected ON bids;
CREATE TRIGGER trg_flag_on_bid_rejected
  AFTER UPDATE OF status ON bids
  FOR EACH ROW
  EXECUTE FUNCTION _trg_flag_on_bid_rejected();

-- Trigger C: complaints — fires when a report is filed
CREATE OR REPLACE FUNCTION _trg_flag_on_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only check providers, not clients
  IF EXISTS (SELECT 1 FROM providers WHERE id = NEW.reported_user_id) THEN
    PERFORM check_and_flag_provider(NEW.reported_user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flag_on_report ON reports;
CREATE TRIGGER trg_flag_on_report
  AFTER INSERT ON reports
  FOR EACH ROW
  EXECUTE FUNCTION _trg_flag_on_report();

-- ─── 9. pg_cron: job abandonment check every hour ────────────

DO $$
BEGIN
  PERFORM cron.unschedule('check-job-abandonment');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'check-job-abandonment',
  '0 * * * *',
  'SELECT check_job_abandonment()'
);

-- ─── 10. Grants ──────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION flag_provider(UUID, TEXT, JSONB)                   TO service_role;
GRANT EXECUTE ON FUNCTION check_and_flag_provider(UUID)                      TO service_role;
GRANT EXECUTE ON FUNCTION resolve_provider_flag(UUID, TEXT, TEXT, TEXT)      TO service_role;
GRANT EXECUTE ON FUNCTION get_unreviewed_flags_count()                       TO service_role;
GRANT EXECUTE ON FUNCTION check_job_abandonment()                            TO service_role;
