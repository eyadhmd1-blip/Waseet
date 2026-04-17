-- ============================================================
-- Migration 011: Provider Profile Sharing
-- - profile_card msg_type for in-chat sharing
-- - saved_providers table (client favorites)
-- - share_events table (analytics)
-- - provider username / public handle
-- - referral tracking + counters
-- ============================================================

-- ── Add profile_card to msg_type enum ───────────────────────

ALTER TYPE msg_type ADD VALUE IF NOT EXISTS 'profile_card';

-- ── Provider: username + share counters ─────────────────────

ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS username          TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS share_count       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_views     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_clients  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS show_public       BOOLEAN NOT NULL DEFAULT TRUE;

-- Auto-generate username from user full_name on insert
CREATE OR REPLACE FUNCTION generate_provider_username()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
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

CREATE OR REPLACE TRIGGER trg_provider_username
  BEFORE INSERT ON providers
  FOR EACH ROW EXECUTE FUNCTION generate_provider_username();

-- ── saved_providers: client bookmarks ───────────────────────

CREATE TABLE IF NOT EXISTS saved_providers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  note        TEXT,                        -- optional personal note
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, provider_id)
);

ALTER TABLE saved_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients manage their saved providers"
  ON saved_providers FOR ALL
  USING  (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

CREATE INDEX IF NOT EXISTS idx_saved_providers_client
  ON saved_providers (client_id, created_at DESC);

-- ── share_events: analytics ──────────────────────────────────

CREATE TABLE IF NOT EXISTS share_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id    UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  shared_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  channel        TEXT NOT NULL CHECK (channel IN ('chat','whatsapp','instagram','twitter','link','other')),
  opened         BOOLEAN NOT NULL DEFAULT FALSE,
  referral_uid   UUID REFERENCES users(id) ON DELETE SET NULL, -- user who signed up via this share
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_events_provider
  ON share_events (provider_id, created_at DESC);

-- ── RPC: increment provider share count ─────────────────────

CREATE OR REPLACE FUNCTION record_profile_share(
  p_provider_id UUID,
  p_shared_by   UUID,
  p_channel     TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
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

-- ── RPC: increment profile view ──────────────────────────────

CREATE OR REPLACE FUNCTION increment_profile_view(p_provider_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE providers SET profile_views = profile_views + 1 WHERE id = p_provider_id;
END;
$$;

-- ── Messages: provider_id column for profile_card ───────────

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS shared_provider_id UUID REFERENCES providers(id) ON DELETE SET NULL;

-- ── View: provider public profile (safe for anon) ───────────

CREATE OR REPLACE VIEW public_provider_profiles AS
SELECT
  pr.id,
  pr.username,
  pr.score,
  pr.reputation_tier,
  pr.lifetime_jobs,
  pr.badge_verified,
  pr.share_count,
  pr.profile_views,
  pr.categories,
  pr.bio,
  u.full_name,
  u.city
FROM providers pr
JOIN users u ON u.id = pr.id
WHERE pr.show_public = TRUE;
