-- Migration 063 — Bid Boost Feature
-- Allows a provider to pay 1 extra credit to pin their bid at the top of the
-- client's bid list for 2 hours. Premium providers boost for free.

-- ── 1. Extend bids table ──────────────────────────────────────────────────────

ALTER TABLE bids
  ADD COLUMN IF NOT EXISTS is_boosted       BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boosted_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN bids.is_boosted       IS 'Whether this bid is currently boosted to the top of the client list';
COMMENT ON COLUMN bids.boosted_at       IS 'When the boost was applied';
COMMENT ON COLUMN bids.boost_expires_at IS 'When the boost expires — 2 hours after boosted_at';

-- ── 2. Index for client-side query (sorting boosted bids first) ───────────────

CREATE INDEX IF NOT EXISTS idx_bids_boosted_active
  ON bids(request_id, boost_expires_at)
  WHERE is_boosted = true;

-- ── 3. RPC: boost_bid ─────────────────────────────────────────────────────────
-- Atomically validates and applies a boost. Returns a JSONB result or error code.

CREATE OR REPLACE FUNCTION boost_bid(
  p_bid_id      UUID,
  p_provider_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bid          bids%ROWTYPE;
  v_provider     providers%ROWTYPE;
  v_active_boost INTEGER;
  v_expires      TIMESTAMPTZ;
BEGIN
  -- Lock bid row to prevent race conditions
  SELECT * INTO v_bid
  FROM bids
  WHERE id = p_bid_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'BID_NOT_FOUND');
  END IF;

  -- Ownership check
  IF v_bid.provider_id <> p_provider_id THEN
    RETURN jsonb_build_object('error', 'UNAUTHORIZED');
  END IF;

  -- Only pending bids can be boosted
  IF v_bid.status <> 'pending' THEN
    RETURN jsonb_build_object('error', 'BID_NOT_PENDING');
  END IF;

  -- Idempotency: already boosted
  IF v_bid.is_boosted THEN
    RETURN jsonb_build_object('error', 'ALREADY_BOOSTED');
  END IF;

  -- One active boost per provider at a time
  SELECT COUNT(*) INTO v_active_boost
  FROM bids
  WHERE provider_id = p_provider_id
    AND is_boosted = true
    AND boost_expires_at > NOW();

  IF v_active_boost > 0 THEN
    RETURN jsonb_build_object('error', 'BOOST_LIMIT_REACHED');
  END IF;

  -- Lock provider row
  SELECT * INTO v_provider
  FROM providers
  WHERE id = p_provider_id
  FOR UPDATE;

  -- Credits check — premium gets free boosts
  IF v_provider.subscription_tier <> 'premium' THEN
    IF COALESCE(v_provider.subscription_credits, 0) < 1 THEN
      RETURN jsonb_build_object('error', 'NO_CREDITS');
    END IF;
    UPDATE providers
    SET subscription_credits = subscription_credits - 1
    WHERE id = p_provider_id;
  END IF;

  -- Apply boost
  v_expires := NOW() + INTERVAL '2 hours';

  UPDATE bids
  SET is_boosted       = true,
      boosted_at       = NOW(),
      boost_expires_at = v_expires
  WHERE id = p_bid_id;

  RETURN jsonb_build_object(
    'success',          true,
    'boost_expires_at', v_expires
  );
END;
$$;

GRANT EXECUTE ON FUNCTION boost_bid(UUID, UUID) TO authenticated;
