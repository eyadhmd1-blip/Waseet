-- ============================================================
-- WASEET — Accept Bid Function + Supporting Policies
-- v1.1 | April 2026
-- ============================================================

-- ── INSERT policy: client can create a job when accepting a bid ──

CREATE POLICY "jobs_insert_client" ON jobs
  FOR INSERT
  WITH CHECK (auth.uid() = client_id);

-- ============================================================
-- FUNCTION: accept_bid
-- Called by the client to accept one bid on their open request.
-- Atomically:
--   1. Validates caller owns the request and it's still open
--   2. Creates the job row
--   3. Marks the accepted bid as 'accepted'
--   4. Marks all other bids on the same request as 'rejected'
--   5. Moves the request to 'in_progress'
-- Returns: { job_id } on success, { error } on failure
-- ============================================================

CREATE OR REPLACE FUNCTION accept_bid(p_bid_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bid    bids%ROWTYPE;
  v_caller UUID := auth.uid();
  v_job_id UUID;
BEGIN
  -- 1. Fetch the bid
  SELECT * INTO v_bid FROM bids WHERE id = p_bid_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'bid_not_found_or_not_pending');
  END IF;

  -- 2. Verify the caller owns the request and it is still open
  IF NOT EXISTS (
    SELECT 1 FROM requests
    WHERE id = v_bid.request_id
      AND client_id = v_caller
      AND status = 'open'
  ) THEN
    RETURN jsonb_build_object('error', 'not_authorized_or_request_closed');
  END IF;

  -- 3. Create job
  INSERT INTO jobs (request_id, bid_id, client_id, provider_id, status)
  VALUES (v_bid.request_id, v_bid.id, v_caller, v_bid.provider_id, 'active')
  RETURNING id INTO v_job_id;

  -- 4. Accept this bid
  UPDATE bids SET status = 'accepted' WHERE id = p_bid_id;

  -- 5. Reject all other bids on the same request
  UPDATE bids
  SET    status = 'rejected'
  WHERE  request_id = v_bid.request_id
    AND  id != p_bid_id;

  -- 6. Move request to in_progress
  UPDATE requests
  SET    status = 'in_progress', updated_at = NOW()
  WHERE  id = v_bid.request_id;

  RETURN jsonb_build_object('job_id', v_job_id);
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION accept_bid(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_bid(UUID) TO authenticated;
