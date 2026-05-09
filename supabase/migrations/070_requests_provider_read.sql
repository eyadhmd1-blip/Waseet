-- ============================================================
-- Migration 070: Allow providers to read requests they have a job on
--
-- Problem: requests_select_open policy only allows reading requests
-- that are 'open' or owned by the authenticated user (client_id).
-- Providers joining requests via jobs.request_id get null for
-- non-open requests (in_progress, completed, cancelled, expired),
-- causing job cards to show empty title/city.
--
-- Fix: Add a permissive SELECT policy so providers can read any
-- request that has a job row where they are the provider.
-- ============================================================

DO $$ BEGIN
  CREATE POLICY "requests_select_provider_job" ON requests
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM jobs
        WHERE jobs.request_id  = requests.id
          AND jobs.provider_id = (SELECT auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
