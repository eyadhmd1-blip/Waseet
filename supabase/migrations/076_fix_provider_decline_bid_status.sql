-- ============================================================
-- 076_fix_provider_decline_bid_status.sql
--
-- Bug: when a provider declines a job, provider_decline_job()
-- was setting ALL bids (including the declined provider's own bid)
-- back to 'pending'. This caused two problems:
--   1. Provider's feed still showed "تم التقديم" for that request
--   2. Client could re-accept the same provider who just declined
--
-- Fix: restore OTHER providers' bids to 'pending' (so client can
-- pick immediately from the existing pool), but mark the declined
-- provider's bid as 'rejected' so it's hidden from client + provider.
-- ============================================================

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

  -- Record decline on job
  UPDATE jobs
  SET provider_declined = TRUE, status = 'cancelled'
  WHERE id = p_job_id;

  -- Restore all OTHER providers' bids to pending
  -- so the client can immediately pick from the existing pool
  UPDATE bids
  SET status = 'pending'
  WHERE request_id = v_job.request_id
    AND id != v_job.bid_id;

  -- Mark the declined provider's bid as rejected
  -- prevents the client from re-accepting the same provider
  -- and removes "تم التقديم" from the provider's feed
  UPDATE bids
  SET status = 'rejected'
  WHERE id = v_job.bid_id;

  -- Reopen request for new bids
  UPDATE requests
  SET status = 'open', updated_at = NOW()
  WHERE id = v_job.request_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION provider_decline_job(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION provider_decline_job(UUID) TO authenticated;
