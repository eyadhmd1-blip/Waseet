-- ============================================================
-- Migration 106: Restore service_role table privileges
--
-- ROOT CAUSE (discovered 2026-06-02):
-- The `service_role` Postgres role was missing the core DML
-- privileges (SELECT, INSERT, UPDATE, DELETE) on public tables —
-- it only had REFERENCES, TRIGGER, TRUNCATE. Meanwhile anon and
-- authenticated had full DML.
--
-- Effect: every server-side (service_role / sb_secret_ key) table
-- read or write inside Edge Functions failed with
-- "permission denied for table X" (SQLSTATE 42501). SECURITY
-- DEFINER RPCs still worked, which masked the problem. This is
-- why in-app notifications were never written, and why
-- notify-client-new-bid / notify-providers-bid-rejected returned
-- 404 (could not read the request row).
--
-- service_role is a server-only role that bypasses RLS and is
-- never exposed to clients, so granting it full DML is the
-- standard, expected Supabase configuration — this RESTORES the
-- intended state rather than weakening security.
-- ============================================================

-- ── Current objects ──────────────────────────────────────────
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO service_role;

-- ── Future objects (so new tables/sequences inherit the grant) ──
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES  TO service_role;
