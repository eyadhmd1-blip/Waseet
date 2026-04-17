-- ============================================================
-- Migration 015: Provider Commitment Flow
-- Adds grace-period + provider-commit deadlines to jobs.
-- Implements RPCs for the smart accept lock system.
-- ============================================================

-- ── New columns on jobs ──────────────────────────────────────

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS client_grace_expires_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_commit_deadline  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_committed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_declined         BOOLEAN NOT NULL DEFAULT FALSE;

-- Index: quickly find jobs awaiting provider commitment
CREATE INDEX IF NOT EXISTS idx_jobs_awaiting_commit
  ON jobs (provider_id, provider_commit_deadline)
  WHERE provider_committed_at IS NULL
    AND provider_declined = FALSE
    AND status = 'active';

-- ── RPC: set_job_deadlines ───────────────────────────────────
-- Called by client immediately after accept_bid() succeeds.
-- Sets the grace window (1 min) and provider commitment deadline.

CREATE OR REPLACE FUNCTION set_job_deadlines(
  p_job_id    UUID,
  p_is_urgent BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commit_interval INTERVAL := CASE
    WHEN p_is_urgent THEN INTERVAL '5 minutes'
    ELSE INTERVAL '15 minutes'
  END;
BEGIN
  UPDATE jobs
  SET
    client_grace_expires_at  = NOW() + INTERVAL '1 minute',
    provider_commit_deadline = NOW() + v_commit_interval
  WHERE id = p_job_id
    AND client_id = auth.uid()
    AND status = 'active';
END;
$$;

REVOKE ALL ON FUNCTION set_job_deadlines(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_job_deadlines(UUID, BOOLEAN) TO authenticated;

-- ── RPC: undo_accept_bid ─────────────────────────────────────
-- Called by client during grace period to reverse acceptance.
-- Only succeeds if: caller is client, grace has not expired,
-- and provider has NOT already committed.

CREATE OR REPLACE FUNCTION undo_accept_bid(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'job_not_found');
  END IF;

  -- Only the client can undo
  IF v_job.client_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  -- Grace period must not have expired
  IF v_job.client_grace_expires_at IS NOT NULL
     AND v_job.client_grace_expires_at < NOW() THEN
    RETURN jsonb_build_object('error', 'grace_period_expired');
  END IF;

  -- Provider must not have already committed
  IF v_job.provider_committed_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'provider_already_committed');
  END IF;

  -- Cancel job
  UPDATE jobs SET status = 'cancelled' WHERE id = p_job_id;

  -- Reopen all bids on this request
  UPDATE bids
  SET status = 'pending'
  WHERE request_id = v_job.request_id;

  -- The accepted bid was rejected by accept_bid — restore it to pending
  UPDATE bids
  SET status = 'pending'
  WHERE id = v_job.bid_id;

  -- Reopen the request
  UPDATE requests
  SET status = 'open', updated_at = NOW()
  WHERE id = v_job.request_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION undo_accept_bid(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION undo_accept_bid(UUID) TO authenticated;

-- ── RPC: provider_commit_job ─────────────────────────────────
-- Provider confirms they will show up within the deadline.

CREATE OR REPLACE FUNCTION provider_commit_job(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'job_not_found');
  END IF;

  IF v_job.provider_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'not_your_job');
  END IF;

  IF v_job.status != 'active' THEN
    RETURN jsonb_build_object('error', 'job_not_active');
  END IF;

  -- Check deadline
  IF v_job.provider_commit_deadline IS NOT NULL
     AND v_job.provider_commit_deadline < NOW() THEN
    -- Auto-expire
    PERFORM expire_job_commitment(p_job_id);
    RETURN jsonb_build_object('error', 'deadline_expired');
  END IF;

  UPDATE jobs
  SET provider_committed_at = NOW()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION provider_commit_job(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION provider_commit_job(UUID) TO authenticated;

-- ── RPC: provider_decline_job ────────────────────────────────
-- Provider declines to show up. Cancels job, reopens bids.

CREATE OR REPLACE FUNCTION provider_decline_job(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'job_not_found');
  END IF;

  IF v_job.provider_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'not_your_job');
  END IF;

  -- Record decline
  UPDATE jobs
  SET provider_declined = TRUE, status = 'cancelled'
  WHERE id = p_job_id;

  -- Reopen bids
  UPDATE bids SET status = 'pending'
  WHERE request_id = v_job.request_id;

  UPDATE bids SET status = 'pending'
  WHERE id = v_job.bid_id;

  -- Reopen request
  UPDATE requests
  SET status = 'open', updated_at = NOW()
  WHERE id = v_job.request_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION provider_decline_job(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION provider_decline_job(UUID) TO authenticated;

-- ── Helper: expire_job_commitment ────────────────────────────
-- Called internally when deadline passes without commitment.

CREATE OR REPLACE FUNCTION expire_job_commitment(p_job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_job.provider_committed_at IS NOT NULL THEN RETURN; END IF; -- already committed

  UPDATE jobs SET status = 'cancelled' WHERE id = p_job_id;

  UPDATE bids SET status = 'pending'
  WHERE request_id = v_job.request_id
     OR id = v_job.bid_id;

  UPDATE requests
  SET status = 'open', updated_at = NOW()
  WHERE id = v_job.request_id;
END;
$$;

-- ── Cron function: sweep expired commitments every minute ────

CREATE OR REPLACE FUNCTION sweep_expired_job_commitments()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM jobs
    WHERE status = 'active'
      AND provider_committed_at IS NULL
      AND provider_declined = FALSE
      AND provider_commit_deadline IS NOT NULL
      AND provider_commit_deadline < NOW()
  LOOP
    PERFORM expire_job_commitment(r.id);
  END LOOP;
END;
$$;

-- ── RLS: providers can read their own pending-commit jobs ────

-- Providers need to read jobs assigned to them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'jobs' AND policyname = 'jobs_provider_read'
  ) THEN
    CREATE POLICY "jobs_provider_read" ON jobs
      FOR SELECT
      USING (
        provider_id = auth.uid()
        OR client_id = auth.uid()
      );
  END IF;
END $$;
