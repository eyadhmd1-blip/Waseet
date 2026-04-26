-- ============================================================
-- Migration 037: Smart Request Routing
--
-- Problem:
--   All open requests were visible to every subscribed provider
--   regardless of their city or service categories. A plumber in
--   Irbid would see AC repair requests in Aqaba — irrelevant noise.
--
-- Fix:
--   Providers only see requests that match BOTH:
--     1. The request's city = the provider's city (from users.city)
--     2. The request's category_slug is in the provider's categories array
--
--   Same logic applied to recurring contract feed.
--
--   Clients still see all their own requests (all statuses).
-- ============================================================

-- ── requests ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "requests_select_open" ON requests;

CREATE POLICY "requests_select_open" ON requests
  FOR SELECT USING (
    -- Client always sees their own requests (all statuses)
    client_id = (SELECT auth.uid())
    OR (
      -- Provider sees open requests in their city that match their categories
      status = 'open'
      AND EXISTS (
        SELECT 1
        FROM providers p
        JOIN users     u ON u.id = p.id
        WHERE p.id             = (SELECT auth.uid())
          AND u.city           = requests.city
          AND requests.category_slug = ANY(p.categories)
      )
    )
  );

-- ── recurring_contracts ──────────────────────────────────────

DROP POLICY IF EXISTS "contracts_provider_select" ON recurring_contracts;

CREATE POLICY "contracts_provider_select" ON recurring_contracts
  FOR SELECT USING (
    -- Provider assigned to this contract always sees it
    provider_id = (SELECT auth.uid())
    OR (
      -- Provider sees bidding contracts in their city that match their categories
      status = 'bidding'
      AND EXISTS (
        SELECT 1
        FROM providers p
        JOIN users     u ON u.id = p.id
        WHERE p.id                         = (SELECT auth.uid())
          AND u.city                       = recurring_contracts.city
          AND recurring_contracts.category_slug = ANY(p.categories)
      )
    )
  );

-- ── Covering index to speed up the EXISTS lookup ─────────────
-- The EXISTS subquery does: users WHERE id = auth.uid() → get city.
-- users.id is PK (fast), but a covering index avoids the heap fetch
-- for the city column on large tables.
CREATE INDEX IF NOT EXISTS idx_users_id_city
  ON users (id, city);

-- GIN index on providers.categories already exists:
--   idx_providers_categories_gin  (created in migration 016)
-- Composite index for requests feed already exists:
--   idx_requests_feed             (created in migration 016)
-- Composite index for contracts already exists:
--   idx_contracts_city_cat        (created in migration 012)
