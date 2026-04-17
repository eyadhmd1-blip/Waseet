-- ============================================================
-- Migration 025: Fix Mutable search_path in Functions
--
-- Problem: functions without SET search_path are vulnerable to
-- search_path hijacking — a malicious schema placed before
-- 'public' in the search path can intercept table lookups.
--
-- Fix: add SET search_path = public, pg_catalog to all
-- SECURITY DEFINER (and other sensitive) functions that lack it.
-- ============================================================

-- ── update_provider_score (trigger fn, migration 001/016) ────

CREATE OR REPLACE FUNCTION update_provider_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_jobs INT;
  v_tier reputation_tier;
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

    SELECT lifetime_jobs INTO v_jobs FROM providers WHERE id = NEW.provider_id;

    v_tier := CASE
      WHEN v_jobs >= 100 THEN 'elite'
      WHEN v_jobs >= 50  THEN 'expert'
      WHEN v_jobs >= 25  THEN 'trusted'
      WHEN v_jobs >= 10  THEN 'rising'
      ELSE 'new'
    END;

    UPDATE providers SET reputation_tier = v_tier WHERE id = NEW.provider_id;

    PERFORM check_loyalty_rewards(NEW.provider_id, v_jobs);

  END IF;
  RETURN NEW;
END;
$$;

-- ── check_loyalty_rewards (migration 001) ────────────────────

CREATE OR REPLACE FUNCTION check_loyalty_rewards(p_id UUID, p_jobs INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF p_jobs = 10 THEN
    UPDATE providers SET loyalty_discount = 20 WHERE id = p_id;
    INSERT INTO loyalty_events (provider_id, event_type, jobs_at_event, reward_value)
      VALUES (p_id, 'discount_20', p_jobs, '20% off next renewal');
  END IF;

  IF p_jobs = 25 THEN
    UPDATE providers SET loyalty_discount = 30, badge_verified = true WHERE id = p_id;
    INSERT INTO loyalty_events (provider_id, event_type, jobs_at_event, reward_value)
      VALUES (p_id, 'discount_30', p_jobs, '30% off + verified badge');
  END IF;

  IF p_jobs = 50 THEN
    UPDATE providers SET free_months_earned = free_months_earned + 1 WHERE id = p_id;
    INSERT INTO loyalty_events (provider_id, event_type, jobs_at_event, reward_value)
      VALUES (p_id, 'free_month', p_jobs, '1 free subscription month');
  END IF;

  IF p_jobs = 100 THEN
    INSERT INTO loyalty_events (provider_id, event_type, jobs_at_event, reward_value)
      VALUES (p_id, 'elite_status', p_jobs, 'Elite status + homepage feature');
  END IF;
END;
$$;

-- ── update_daily_analytics (migration 001) ───────────────────

CREATE OR REPLACE FUNCTION update_daily_analytics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.confirmed_by_client = true AND OLD.confirmed_by_client = false THEN
    INSERT INTO provider_analytics (provider_id, date, jobs_done, bids_won)
      VALUES (NEW.provider_id, CURRENT_DATE, 1, 1)
    ON CONFLICT (provider_id, date)
      DO UPDATE SET
        jobs_done = provider_analytics.jobs_done + 1,
        bids_won  = provider_analytics.bids_won  + 1;
  END IF;
  RETURN NEW;
END;
$$;

-- ── generate_provider_username (migration 011) ───────────────

CREATE OR REPLACE FUNCTION generate_provider_username()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  base_name TEXT;
  candidate TEXT;
  counter   INT := 0;
BEGIN
  IF NEW.username IS NOT NULL THEN RETURN NEW; END IF;
  SELECT regexp_replace(lower(u.full_name), '[^a-z0-9]', '', 'g')
  INTO base_name
  FROM users u WHERE u.id = NEW.id;
  IF base_name IS NULL OR base_name = '' THEN base_name := 'provider'; END IF;
  candidate := base_name;
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM providers WHERE username = candidate);
    counter   := counter + 1;
    candidate := base_name || counter::TEXT;
  END LOOP;
  NEW.username := candidate;
  RETURN NEW;
END;
$$;

-- ── record_profile_share (migration 011) ─────────────────────

CREATE OR REPLACE FUNCTION record_profile_share(
  p_provider_id UUID,
  p_shared_by   UUID,
  p_channel     TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO share_events (provider_id, shared_by, channel)
  VALUES (p_provider_id, p_shared_by, p_channel)
  RETURNING id INTO v_id;

  UPDATE providers SET share_count = share_count + 1 WHERE id = p_provider_id;
  RETURN v_id;
END;
$$;

-- ── increment_profile_view (migration 011) ───────────────────

CREATE OR REPLACE FUNCTION increment_profile_view(p_provider_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE providers SET profile_views = profile_views + 1 WHERE id = p_provider_id;
END;
$$;

-- ── mark_notification_opened (migration 008) ─────────────────

CREATE OR REPLACE FUNCTION mark_notification_opened(notif_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE notification_log
  SET opened_at = NOW()
  WHERE id = notif_id AND opened_at IS NULL;
END;
$$;

-- ── mark_notification_converted (migration 008) ──────────────

CREATE OR REPLACE FUNCTION mark_notification_converted(notif_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE notification_log
  SET converted_at = NOW()
  WHERE id = notif_id AND converted_at IS NULL;
END;
$$;

-- ── create_notification_preferences (migration 008) ──────────

CREATE OR REPLACE FUNCTION create_notification_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── get_available_providers_for_urgent (migration 009) ────────

CREATE OR REPLACE FUNCTION get_available_providers_for_urgent(
  p_city          TEXT,
  p_category_slug TEXT
)
RETURNS TABLE (provider_id UUID, token TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT DISTINCT
    pr.id   AS provider_id,
    pt.token
  FROM providers pr
  JOIN push_tokens pt ON pt.user_id = pr.id
  JOIN users u        ON u.id = pr.id
  WHERE pr.is_available   = TRUE
    AND pr.urgent_enabled = TRUE
    AND u.city            = p_city
    AND p_category_slug   = ANY(pr.categories)
  LIMIT 15;
$$;

-- ── contract_total_visits (migration 012) ────────────────────

CREATE OR REPLACE FUNCTION contract_total_visits(freq recurrence_frequency, months INTEGER)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_catalog
AS $$
  SELECT CASE freq
    WHEN 'weekly'   THEN months * 4
    WHEN 'biweekly' THEN months * 2
    WHEN 'monthly'  THEN months
  END;
$$;

-- ── accept_contract_bid (migration 012) ──────────────────────

CREATE OR REPLACE FUNCTION accept_contract_bid(p_bid_id UUID, p_client_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_bid      contract_bids;
  v_contract recurring_contracts;
  v_starts   TIMESTAMPTZ := NOW();
  v_ends     TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_bid FROM contract_bids WHERE id = p_bid_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'bid_not_found'; END IF;

  SELECT * INTO v_contract FROM recurring_contracts WHERE id = v_bid.contract_id;
  IF v_contract.client_id <> p_client_id THEN RAISE EXCEPTION 'not_owner'; END IF;
  IF v_contract.status <> 'bidding' THEN RAISE EXCEPTION 'contract_not_bidding'; END IF;

  v_ends := v_starts + (v_contract.duration_months || ' months')::INTERVAL;

  UPDATE contract_bids SET status = 'accepted' WHERE id = p_bid_id;
  UPDATE contract_bids SET status = 'rejected'
    WHERE contract_id = v_bid.contract_id AND id <> p_bid_id AND status = 'pending';

  UPDATE recurring_contracts SET
    provider_id     = v_bid.provider_id,
    price_per_visit = v_bid.price_per_visit,
    currency        = v_bid.currency,
    status          = 'active',
    starts_at       = v_starts,
    ends_at         = v_ends,
    updated_at      = NOW()
  WHERE id = v_contract.id;

  PERFORM schedule_upcoming_visits(v_contract.id, v_starts, v_contract.frequency, v_contract.preferred_day, 3);
END;
$$;

-- ── schedule_upcoming_visits (migration 012) ─────────────────

CREATE OR REPLACE FUNCTION schedule_upcoming_visits(
  p_contract_id UUID,
  p_from        TIMESTAMPTZ,
  p_freq        recurrence_frequency,
  p_day         INTEGER,
  p_count       INTEGER DEFAULT 3
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_interval INTERVAL;
  v_next     TIMESTAMPTZ := p_from;
  i          INTEGER;
BEGIN
  v_interval := CASE p_freq
    WHEN 'weekly'   THEN '7 days'::INTERVAL
    WHEN 'biweekly' THEN '14 days'::INTERVAL
    WHEN 'monthly'  THEN '1 month'::INTERVAL
  END;

  IF p_day IS NOT NULL THEN
    WHILE EXTRACT(DOW FROM v_next) <> p_day LOOP
      v_next := v_next + '1 day'::INTERVAL;
    END LOOP;
  END IF;

  FOR i IN 1..p_count LOOP
    INSERT INTO contract_visits (contract_id, scheduled_at)
    VALUES (p_contract_id, v_next)
    ON CONFLICT DO NOTHING;
    v_next := v_next + v_interval;
  END LOOP;
END;
$$;

-- ── submit_contract_bid (migration 012) ──────────────────────

CREATE OR REPLACE FUNCTION submit_contract_bid(
  p_contract_id     UUID,
  p_provider_id     UUID,
  p_price_per_visit NUMERIC,
  p_note            TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_contract recurring_contracts;
  v_bid_id   UUID;
BEGIN
  SELECT * INTO v_contract FROM recurring_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract_not_found'; END IF;
  IF v_contract.status <> 'bidding' THEN RAISE EXCEPTION 'contract_not_accepting_bids'; END IF;

  INSERT INTO contract_bids (contract_id, provider_id, price_per_visit, note)
  VALUES (p_contract_id, p_provider_id, p_price_per_visit, p_note)
  ON CONFLICT (contract_id, provider_id)
  DO UPDATE SET price_per_visit = EXCLUDED.price_per_visit, note = EXCLUDED.note, status = 'pending'
  RETURNING id INTO v_bid_id;

  RETURN v_bid_id;
END;
$$;

-- ── complete_contract_visit (migration 012) ───────────────────

CREATE OR REPLACE FUNCTION complete_contract_visit(
  p_visit_id    UUID,
  p_provider_id UUID,
  p_rating      INTEGER DEFAULT NULL,
  p_note        TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_visit contract_visits;
BEGIN
  SELECT * INTO v_visit FROM contract_visits WHERE id = p_visit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'visit_not_found'; END IF;

  UPDATE contract_visits SET
    status        = 'completed',
    completed_at  = NOW(),
    client_rating = COALESCE(p_rating, client_rating),
    client_note   = COALESCE(p_note, client_note)
  WHERE id = p_visit_id;

  UPDATE recurring_contracts SET
    completed_visits = completed_visits + 1,
    updated_at       = NOW()
  WHERE id = v_visit.contract_id;

  PERFORM schedule_upcoming_visits(
    v_visit.contract_id,
    NOW(),
    (SELECT frequency FROM recurring_contracts WHERE id = v_visit.contract_id),
    (SELECT preferred_day FROM recurring_contracts WHERE id = v_visit.contract_id),
    1
  );
END;
$$;

-- ── set_updated_at (migration 014) ───────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ── increment_portfolio_view (migration 007) ─────────────────

CREATE OR REPLACE FUNCTION increment_portfolio_view(item_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE portfolio_items SET views_count = views_count + 1 WHERE id = item_id;
END;
$$;
