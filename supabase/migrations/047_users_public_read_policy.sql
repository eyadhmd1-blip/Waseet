-- ============================================================
-- Fix: Allow authenticated users to read other users' profiles
--
-- Problem: users_select_own only allows reading one's own row.
-- Supabase JOINs (bids → providers → users) return null when RLS
-- blocks the joined row, causing a null crash on full_name in the
-- client's bid list screen.
--
-- Fix: Add a permissive SELECT policy for all authenticated users.
-- The users table holds profile data only (full_name, city, role,
-- avatar_url, phone). Auth credentials live in auth.users which is
-- never exposed via RLS.
-- ============================================================

DO $$ BEGIN
  CREATE POLICY "users_select_authenticated"
    ON users FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
