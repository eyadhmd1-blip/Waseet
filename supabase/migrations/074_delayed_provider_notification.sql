-- ============================================================
-- 074_delayed_provider_notification.sql
--
-- Delays the "bid accepted" push notification to the provider
-- until after the client's 60-second grace period expires.
--
-- Problem: request-detail.tsx was firing notify-provider-bid-accepted
-- immediately after accept_bid(), before the grace period — so if the
-- client cancelled within 60 s the provider had already been notified.
--
-- Solution:
--   • Add provider_notif_due_at  — when the grace period ends (NOW()+1 min)
--   • Add provider_notif_sent    — prevents double-sends
--   • Rewrite accept_bid() to set provider_notif_due_at on INSERT
--   • A pg_cron job (migration 075) calls send-delayed-commit-notifications
--     every minute to flush due rows.
-- ============================================================

-- ── 1. New columns on jobs ────────────────────────────────────

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS provider_notif_due_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_notif_sent     BOOLEAN NOT NULL DEFAULT false;

-- Partial index — cron query only scans unsent active jobs
CREATE INDEX IF NOT EXISTS idx_jobs_notif_pending
  ON jobs (provider_notif_due_at)
  WHERE provider_notif_sent = false AND status = 'active';

-- ── 2. Update accept_bid() ────────────────────────────────────
-- Identical logic to migration 002 but now sets provider_notif_due_at
-- so the server-side cron can send the notification after grace period.

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

  -- 3. Create job — schedule provider notification 1 minute from now
  --    (grace period is 60 s; if client undoes, status changes → cron skips)
  INSERT INTO jobs (
    request_id, bid_id, client_id, provider_id,
    status, provider_notif_due_at
  )
  VALUES (
    v_bid.request_id, v_bid.id, v_caller, v_bid.provider_id,
    'active', NOW() + INTERVAL '1 minute'
  )
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

REVOKE ALL ON FUNCTION accept_bid(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_bid(UUID) TO authenticated;
