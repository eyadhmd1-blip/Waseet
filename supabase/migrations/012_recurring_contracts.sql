-- ============================================================
-- WASEET — Migration 012: Recurring Contracts
-- Enables long-term periodic service contracts with bidding
-- ============================================================

-- ── Enums ─────────────────────────────────────────────────────

CREATE TYPE recurrence_frequency AS ENUM ('weekly', 'biweekly', 'monthly');
CREATE TYPE contract_status      AS ENUM ('bidding', 'active', 'paused', 'completed', 'cancelled');
CREATE TYPE visit_status         AS ENUM ('scheduled', 'completed', 'postponed', 'missed');

-- ── Recurring Contracts ────────────────────────────────────────

CREATE TABLE recurring_contracts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id           UUID REFERENCES users(id),           -- set when bid accepted
  category_slug         TEXT NOT NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  city                  TEXT NOT NULL,
  frequency             recurrence_frequency NOT NULL,
  preferred_day         INTEGER CHECK (preferred_day BETWEEN 0 AND 6), -- 0=Sun…6=Sat
  preferred_time_window TEXT CHECK (preferred_time_window IN ('morning','afternoon','evening','flexible')),
  duration_months       INTEGER NOT NULL CHECK (duration_months IN (3,6,12)),
  price_per_visit       NUMERIC(10,2),                       -- set when bid accepted
  currency              TEXT DEFAULT 'JOD',
  status                contract_status DEFAULT 'bidding',
  starts_at             TIMESTAMPTZ,
  ends_at               TIMESTAMPTZ,
  completed_visits      INTEGER DEFAULT 0,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Computed column helper (PostgreSQL doesn't support GENERATED with CASE on enum easily, use a function)
-- total_visits is derived via RPC / view

-- ── Contract Bids ──────────────────────────────────────────────

CREATE TABLE contract_bids (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     UUID NOT NULL REFERENCES recurring_contracts(id) ON DELETE CASCADE,
  provider_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price_per_visit NUMERIC(10,2) NOT NULL,
  currency        TEXT DEFAULT 'JOD',
  note            TEXT,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','withdrawn')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (contract_id, provider_id)
);

-- ── Visit Log ─────────────────────────────────────────────────

CREATE TABLE contract_visits (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id    UUID NOT NULL REFERENCES recurring_contracts(id) ON DELETE CASCADE,
  scheduled_at   TIMESTAMPTZ NOT NULL,
  completed_at   TIMESTAMPTZ,
  status         visit_status DEFAULT 'scheduled',
  client_rating  INTEGER CHECK (client_rating BETWEEN 1 AND 5),
  client_note    TEXT,
  postponed_to   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────

CREATE INDEX idx_contracts_client   ON recurring_contracts(client_id);
CREATE INDEX idx_contracts_provider ON recurring_contracts(provider_id);
CREATE INDEX idx_contracts_status   ON recurring_contracts(status);
CREATE INDEX idx_contracts_city_cat ON recurring_contracts(city, category_slug) WHERE status = 'bidding';
CREATE INDEX idx_contract_bids_contract ON contract_bids(contract_id);
CREATE INDEX idx_contract_visits_contract ON contract_visits(contract_id);

-- ── Helper: total visits per contract ─────────────────────────

CREATE OR REPLACE FUNCTION contract_total_visits(freq recurrence_frequency, months INTEGER)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE freq
    WHEN 'weekly'   THEN months * 4
    WHEN 'biweekly' THEN months * 2
    WHEN 'monthly'  THEN months
  END;
$$;

-- ── Accept contract bid ────────────────────────────────────────

CREATE OR REPLACE FUNCTION accept_contract_bid(p_bid_id UUID, p_client_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bid     contract_bids;
  v_contract recurring_contracts;
  v_starts  TIMESTAMPTZ := NOW();
  v_ends    TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_bid FROM contract_bids WHERE id = p_bid_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'bid_not_found'; END IF;

  SELECT * INTO v_contract FROM recurring_contracts WHERE id = v_bid.contract_id;
  IF v_contract.client_id <> p_client_id THEN RAISE EXCEPTION 'not_owner'; END IF;
  IF v_contract.status <> 'bidding' THEN RAISE EXCEPTION 'contract_not_bidding'; END IF;

  v_ends := v_starts + (v_contract.duration_months || ' months')::INTERVAL;

  -- Accept the bid
  UPDATE contract_bids SET status = 'accepted' WHERE id = p_bid_id;
  -- Reject all others
  UPDATE contract_bids SET status = 'rejected'
    WHERE contract_id = v_bid.contract_id AND id <> p_bid_id AND status = 'pending';

  -- Activate contract
  UPDATE recurring_contracts SET
    provider_id     = v_bid.provider_id,
    price_per_visit = v_bid.price_per_visit,
    currency        = v_bid.currency,
    status          = 'active',
    starts_at       = v_starts,
    ends_at         = v_ends,
    updated_at      = NOW()
  WHERE id = v_contract.id;

  -- Schedule first visits (next 3 occurrences)
  PERFORM schedule_upcoming_visits(v_contract.id, v_starts, v_contract.frequency, v_contract.preferred_day, 3);
END;
$$;

-- ── Schedule upcoming visits ───────────────────────────────────

CREATE OR REPLACE FUNCTION schedule_upcoming_visits(
  p_contract_id UUID,
  p_from        TIMESTAMPTZ,
  p_freq        recurrence_frequency,
  p_day         INTEGER,      -- 0-6 preferred day, NULL = flexible
  p_count       INTEGER DEFAULT 3
)
RETURNS VOID LANGUAGE plpgsql AS $$
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

  -- Snap to preferred day if given
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

-- ── Provider submits contract bid ─────────────────────────────

CREATE OR REPLACE FUNCTION submit_contract_bid(
  p_contract_id     UUID,
  p_provider_id     UUID,
  p_price_per_visit NUMERIC,
  p_note            TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- ── Mark visit completed ───────────────────────────────────────

CREATE OR REPLACE FUNCTION complete_contract_visit(
  p_visit_id    UUID,
  p_provider_id UUID,
  p_rating      INTEGER DEFAULT NULL,
  p_note        TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
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

  -- Schedule the next visit
  PERFORM schedule_upcoming_visits(
    v_visit.contract_id,
    NOW(),
    (SELECT frequency FROM recurring_contracts WHERE id = v_visit.contract_id),
    (SELECT preferred_day FROM recurring_contracts WHERE id = v_visit.contract_id),
    1
  );
END;
$$;

-- ── View: open contracts feed for providers ────────────────────

CREATE OR REPLACE VIEW public_contract_feed AS
SELECT
  rc.*,
  u.full_name AS client_name,
  contract_total_visits(rc.frequency, rc.duration_months) AS total_visits,
  (SELECT COUNT(*) FROM contract_bids cb WHERE cb.contract_id = rc.id AND cb.status = 'pending') AS bids_count
FROM recurring_contracts rc
JOIN users u ON u.id = rc.client_id
WHERE rc.status = 'bidding';

-- ── RLS ────────────────────────────────────────────────────────

ALTER TABLE recurring_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_bids       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_visits     ENABLE ROW LEVEL SECURITY;

-- Contracts: client owns theirs; providers see bidding ones in their city
CREATE POLICY "client owns contract"   ON recurring_contracts FOR ALL USING (client_id = auth.uid());
CREATE POLICY "provider sees bidding"  ON recurring_contracts FOR SELECT
  USING (status = 'bidding' OR provider_id = auth.uid());

-- Contract bids: provider owns theirs; client sees bids on their contracts
CREATE POLICY "provider owns bid"  ON contract_bids FOR ALL USING (provider_id = auth.uid());
CREATE POLICY "client sees bids"   ON contract_bids FOR SELECT
  USING (contract_id IN (SELECT id FROM recurring_contracts WHERE client_id = auth.uid()));

-- Visits: visible to contract participants
CREATE POLICY "contract participants see visits" ON contract_visits FOR SELECT
  USING (
    contract_id IN (
      SELECT id FROM recurring_contracts
      WHERE client_id = auth.uid() OR provider_id = auth.uid()
    )
  );
CREATE POLICY "provider updates visits" ON contract_visits FOR UPDATE
  USING (
    contract_id IN (
      SELECT id FROM recurring_contracts WHERE provider_id = auth.uid()
    )
  );
