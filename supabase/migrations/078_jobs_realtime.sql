-- ============================================================
-- Migration 078: Add jobs table to Realtime publication
--
-- Enables the live confirm_code update in request-detail.tsx:
-- when provider presses "أنجزت العمل", the code appears on the
-- client's screen instantly without requiring a manual refresh.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
  END IF;
END $$;
