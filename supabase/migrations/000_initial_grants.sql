-- ============================================================
-- Migration 000: Initial Schema Grants
--
-- Required for Supabase projects created after May 30, 2026.
-- New projects no longer auto-grant table access to anon/authenticated.
-- This migration must run BEFORE all other migrations (001+).
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated;
