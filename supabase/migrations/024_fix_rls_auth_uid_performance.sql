-- ============================================================
-- Migration 024: Fix RLS Policy Performance
--
-- Problem: auth.uid() called directly in USING/WITH CHECK re-evaluates
-- per row scanned. Wrapping in (SELECT auth.uid()) evaluates once per
-- query — major performance gain at scale (1M+ rows).
--
-- Affected tables: users, providers, requests, bids, jobs, messages,
-- contract_bids, recurring_contracts, contract_visits,
-- support_tickets, support_messages, notification_preferences,
-- notification_log, saved_providers, portfolio_items, reports,
-- push_tokens
-- ============================================================

-- ── users ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "users_select_own"  ON users;
DROP POLICY IF EXISTS "users_update_own"  ON users;

CREATE POLICY "users_select_own" ON users
  FOR SELECT USING ((SELECT auth.uid()) = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING ((SELECT auth.uid()) = id);

-- ── providers ────────────────────────────────────────────────

DROP POLICY IF EXISTS "providers_update_own" ON providers;

CREATE POLICY "providers_update_own" ON providers
  FOR UPDATE USING ((SELECT auth.uid()) = id);

-- providers_select_all uses USING (true) — no change needed

-- ── requests ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "requests_select_open"   ON requests;
DROP POLICY IF EXISTS "requests_insert_client" ON requests;
DROP POLICY IF EXISTS "requests_update_own"    ON requests;

CREATE POLICY "requests_select_open" ON requests
  FOR SELECT USING (status = 'open' OR client_id = (SELECT auth.uid()));

CREATE POLICY "requests_insert_client" ON requests
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = client_id);

CREATE POLICY "requests_update_own" ON requests
  FOR UPDATE USING ((SELECT auth.uid()) = client_id);

-- ── bids ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "bids_select_relevant"   ON bids;
DROP POLICY IF EXISTS "bids_insert_subscribed" ON bids;
DROP POLICY IF EXISTS "bids_update_own"        ON bids;

CREATE POLICY "bids_select_relevant" ON bids
  FOR SELECT
  USING (
    provider_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = bids.request_id
        AND requests.client_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "bids_insert_subscribed" ON bids
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = provider_id AND
    EXISTS (SELECT 1 FROM providers WHERE id = (SELECT auth.uid()) AND is_subscribed = true)
  );

CREATE POLICY "bids_update_own" ON bids
  FOR UPDATE USING ((SELECT auth.uid()) = provider_id);

-- ── jobs ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "jobs_select_participants"    ON jobs;
DROP POLICY IF EXISTS "jobs_update_client_confirm"  ON jobs;
DROP POLICY IF EXISTS "jobs_insert_client"          ON jobs;
DROP POLICY IF EXISTS "jobs_provider_read"          ON jobs;

CREATE POLICY "jobs_select_participants" ON jobs
  FOR SELECT
  USING (client_id = (SELECT auth.uid()) OR provider_id = (SELECT auth.uid()));

CREATE POLICY "jobs_update_client_confirm" ON jobs
  FOR UPDATE
  USING (client_id = (SELECT auth.uid()) OR provider_id = (SELECT auth.uid()));

CREATE POLICY "jobs_insert_client" ON jobs
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = client_id);

-- ── messages ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "messages_select_participants" ON messages;
DROP POLICY IF EXISTS "messages_insert_participants" ON messages;

CREATE POLICY "messages_select_participants" ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = messages.job_id
        AND (jobs.client_id = (SELECT auth.uid()) OR jobs.provider_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "messages_insert_participants" ON messages
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = sender_id
    AND EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = messages.job_id
        AND (jobs.client_id = (SELECT auth.uid()) OR jobs.provider_id = (SELECT auth.uid()))
    )
  );

-- ── recurring_contracts ──────────────────────────────────────

DROP POLICY IF EXISTS "client owns contract"  ON recurring_contracts;
DROP POLICY IF EXISTS "provider sees bidding" ON recurring_contracts;

CREATE POLICY "client owns contract" ON recurring_contracts
  FOR ALL USING (client_id = (SELECT auth.uid()));

CREATE POLICY "provider sees bidding" ON recurring_contracts
  FOR SELECT
  USING (status = 'bidding' OR provider_id = (SELECT auth.uid()));

-- ── contract_bids ────────────────────────────────────────────

DROP POLICY IF EXISTS "provider owns bid" ON contract_bids;
DROP POLICY IF EXISTS "client sees bids"  ON contract_bids;

CREATE POLICY "provider owns bid" ON contract_bids
  FOR ALL USING (provider_id = (SELECT auth.uid()));

CREATE POLICY "client sees bids" ON contract_bids
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recurring_contracts
      WHERE recurring_contracts.id = contract_bids.contract_id
        AND recurring_contracts.client_id = (SELECT auth.uid())
    )
  );

-- ── contract_visits ──────────────────────────────────────────

DROP POLICY IF EXISTS "contract participants see visits" ON contract_visits;
DROP POLICY IF EXISTS "provider updates visits"         ON contract_visits;

CREATE POLICY "contract participants see visits" ON contract_visits
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recurring_contracts
      WHERE recurring_contracts.id = contract_visits.contract_id
        AND (
          recurring_contracts.client_id   = (SELECT auth.uid())
          OR recurring_contracts.provider_id = (SELECT auth.uid())
        )
    )
  );

CREATE POLICY "provider updates visits" ON contract_visits
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM recurring_contracts
      WHERE recurring_contracts.id = contract_visits.contract_id
        AND recurring_contracts.provider_id = (SELECT auth.uid())
    )
  );

-- ── support_tickets ──────────────────────────────────────────

DROP POLICY IF EXISTS "user_own_tickets" ON support_tickets;

CREATE POLICY "user_own_tickets" ON support_tickets
  FOR ALL USING (user_id = (SELECT auth.uid()));

-- ── support_messages ─────────────────────────────────────────

DROP POLICY IF EXISTS "user_ticket_messages" ON support_messages;

CREATE POLICY "user_ticket_messages" ON support_messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = support_messages.ticket_id
        AND support_tickets.user_id = (SELECT auth.uid())
    )
  );

-- ── notification_preferences ─────────────────────────────────

DROP POLICY IF EXISTS "notif_pref_own" ON notification_preferences;

CREATE POLICY "notif_pref_own" ON notification_preferences
  FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ── notification_log ─────────────────────────────────────────

DROP POLICY IF EXISTS "notif_log_read_own" ON notification_log;

CREATE POLICY "notif_log_read_own" ON notification_log
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- ── saved_providers ──────────────────────────────────────────

DROP POLICY IF EXISTS "clients manage their saved providers" ON saved_providers;

CREATE POLICY "clients manage their saved providers" ON saved_providers
  FOR ALL
  USING  ((SELECT auth.uid()) = client_id)
  WITH CHECK ((SELECT auth.uid()) = client_id);

-- ── portfolio_items ──────────────────────────────────────────

DROP POLICY IF EXISTS "portfolio_insert_own"  ON portfolio_items;
DROP POLICY IF EXISTS "portfolio_delete_own"  ON portfolio_items;

CREATE POLICY "portfolio_insert_own" ON portfolio_items
  FOR INSERT TO authenticated
  WITH CHECK (provider_id = (SELECT auth.uid()));

CREATE POLICY "portfolio_delete_own" ON portfolio_items
  FOR DELETE TO authenticated
  USING (provider_id = (SELECT auth.uid()));

-- ── reports ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "reporter_read_own"   ON reports;
DROP POLICY IF EXISTS "reporter_insert_own" ON reports;

CREATE POLICY "reporter_read_own" ON reports
  FOR SELECT USING ((SELECT auth.uid()) = reporter_id);

CREATE POLICY "reporter_insert_own" ON reports
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = reporter_id);

-- ── analytics / loyalty / subscriptions ──────────────────────

DROP POLICY IF EXISTS "analytics_own"    ON provider_analytics;
DROP POLICY IF EXISTS "loyalty_own"      ON loyalty_events;
DROP POLICY IF EXISTS "subscriptions_own" ON subscriptions;

CREATE POLICY "analytics_own" ON provider_analytics
  FOR SELECT USING (provider_id = (SELECT auth.uid()));

CREATE POLICY "loyalty_own" ON loyalty_events
  FOR SELECT USING (provider_id = (SELECT auth.uid()));

CREATE POLICY "subscriptions_own" ON subscriptions
  FOR SELECT USING (provider_id = (SELECT auth.uid()));

-- ── share_events (added in 023) ───────────────────────────────

DROP POLICY IF EXISTS "share_events_provider_read_own"       ON share_events;
DROP POLICY IF EXISTS "share_events_insert_authenticated"    ON share_events;

CREATE POLICY "share_events_provider_read_own" ON share_events
  FOR SELECT USING (provider_id = (SELECT auth.uid()));

CREATE POLICY "share_events_insert_authenticated" ON share_events
  FOR INSERT
  WITH CHECK (shared_by = (SELECT auth.uid()) OR shared_by IS NULL);
