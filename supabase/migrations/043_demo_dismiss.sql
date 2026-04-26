-- ============================================================
-- Migration 043: Persistent Demo Dismissal
--
-- Adds a `dismissed` flag to provider_demo_status so that when
-- a provider taps "فهمت، إخفاء نهائياً" or "عرض الطلبات الحقيقية"
-- the demo never reappears — even after a pull-to-refresh or
-- re-opening the app.
--
-- Zero impact on real requests, bids, or any other table.
-- ============================================================

-- ── 1. Add column ─────────────────────────────────────────────

ALTER TABLE provider_demo_status
  ADD COLUMN IF NOT EXISTS dismissed     BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dismissed_at  TIMESTAMPTZ;

-- ── 2. Update get_provider_demo to respect dismissed flag ─────

CREATE OR REPLACE FUNCTION get_provider_demo(p_provider_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demo provider_demo_status%ROWTYPE;
  v_req  demo_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_demo
  FROM provider_demo_status
  WHERE provider_id = p_provider_id;

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Dismissed permanently by the provider
  IF v_demo.dismissed THEN RETURN NULL; END IF;

  -- Already submitted — return submitted state (still dismissible)
  IF v_demo.bid_submitted THEN
    RETURN jsonb_build_object(
      'status',     'submitted',
      'bid_amount', v_demo.bid_amount,
      'bid_note',   v_demo.bid_note
    );
  END IF;

  -- Expired without bid → treat as dismissed
  IF v_demo.expires_at < now() THEN
    RETURN NULL;
  END IF;

  -- Not ready yet (inside first hour)
  IF v_demo.send_after > now() THEN
    RETURN NULL;
  END IF;

  -- Fetch template
  SELECT * INTO v_req
  FROM demo_requests
  WHERE id = v_demo.demo_request_id;

  RETURN jsonb_build_object(
    'status',     'pending',
    'expires_at', v_demo.expires_at,
    'request', jsonb_build_object(
      'id',            v_req.id,
      'title',         v_req.title,
      'description',   v_req.description,
      'city',          v_req.city,
      'district',      v_req.district,
      'category_slug', v_req.category_slug,
      'is_urgent',     v_req.is_urgent
    )
  );
END;
$$;

-- ── 3. New RPC: dismiss_provider_demo ─────────────────────────
-- Called by the app when provider taps skip/dismiss.
-- Idempotent — safe to call multiple times.

CREATE OR REPLACE FUNCTION dismiss_provider_demo(p_provider_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE provider_demo_status
  SET dismissed    = true,
      dismissed_at = now()
  WHERE provider_id = p_provider_id
    AND dismissed   = false;
END;
$$;
