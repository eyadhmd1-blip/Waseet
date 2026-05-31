-- ============================================================
-- Migration 100: Enable Realtime for Missing Tables
--
-- Adds messages, requests, bids, providers, notifications
-- to the supabase_realtime publication so Realtime subscriptions
-- in the mobile app work automatically on every environment.
--
-- Already enabled via earlier migrations:
--   jobs             (migration 078)
--   support_messages (migration 050)
--   support_tickets  (migration 050)
-- ============================================================

DO $$ BEGIN

  -- messages — chat real-time delivery (client + provider)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;

  -- requests — new requests appear instantly in provider feed
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE requests;
  END IF;

  -- bids — new bids appear instantly in client request detail
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bids'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE bids;
  END IF;

  -- providers — credit balance updates in real-time after bid submission
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'providers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE providers;
  END IF;

  -- notifications — in-app notification inbox updates instantly
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;

END $$;
