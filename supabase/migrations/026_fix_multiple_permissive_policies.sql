-- ============================================================
-- Migration 026: Merge Multiple Permissive SELECT Policies
--
-- Problem: two permissive SELECT policies on the same table means
-- PostgreSQL evaluates BOTH for every row, even if the first
-- already matched — halving performance.
--
-- Fix: merge into a single policy with OR conditions.
--
-- Affected tables:
--   - contract_bids  ("provider owns bid" + "client sees bids")
--   - jobs           ("jobs_select_participants" + "jobs_provider_read")
--   - recurring_contracts ("client owns contract" + "provider sees bidding")
-- ============================================================

-- ── contract_bids ─────────────────────────────────────────────
-- Drop separate SELECT policies; the FOR ALL on "provider owns bid"
-- already covers SELECT for providers. Replace "client sees bids"
-- with a merged unified SELECT policy.

DROP POLICY IF EXISTS "provider owns bid" ON contract_bids;
DROP POLICY IF EXISTS "client sees bids"  ON contract_bids;

-- Unified SELECT: provider sees their own bids, client sees bids on their contracts
CREATE POLICY "contract_bids_select" ON contract_bids
  FOR SELECT
  USING (
    provider_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM recurring_contracts
      WHERE recurring_contracts.id = contract_bids.contract_id
        AND recurring_contracts.client_id = (SELECT auth.uid())
    )
  );

-- Keep write policies scoped
CREATE POLICY "contract_bids_write_provider" ON contract_bids
  FOR ALL
  USING (provider_id = (SELECT auth.uid()))
  WITH CHECK (provider_id = (SELECT auth.uid()));

-- ── jobs ──────────────────────────────────────────────────────
-- "jobs_select_participants" and "jobs_provider_read" both cover SELECT
-- with identical (or overlapping) conditions. Merge into one.

DROP POLICY IF EXISTS "jobs_select_participants" ON jobs;
DROP POLICY IF EXISTS "jobs_provider_read"        ON jobs;

CREATE POLICY "jobs_select_participants" ON jobs
  FOR SELECT
  USING (client_id = (SELECT auth.uid()) OR provider_id = (SELECT auth.uid()));

-- ── recurring_contracts ───────────────────────────────────────
-- "client owns contract" is FOR ALL (covers SELECT for clients).
-- "provider sees bidding" adds another SELECT policy.
-- Drop both and recreate: one FOR ALL for clients, one SELECT for providers.

DROP POLICY IF EXISTS "client owns contract"  ON recurring_contracts;
DROP POLICY IF EXISTS "provider sees bidding" ON recurring_contracts;

-- Clients: full access to their own contracts
CREATE POLICY "contracts_client_all" ON recurring_contracts
  FOR ALL
  USING (client_id = (SELECT auth.uid()))
  WITH CHECK (client_id = (SELECT auth.uid()));

-- Providers + public: single SELECT covering bidding contracts AND assigned ones
CREATE POLICY "contracts_provider_select" ON recurring_contracts
  FOR SELECT
  USING (status = 'bidding' OR provider_id = (SELECT auth.uid()));
