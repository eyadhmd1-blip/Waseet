-- ============================================================
-- WASEET — Ensure Storage Buckets Exist
-- 059 | May 2026
-- Idempotently guarantees portfolio-media, chat-media, and
-- chat-audio buckets + their RLS policies are in place.
-- Safe to run even if earlier migrations already applied them.
-- ============================================================

-- ── portfolio-media ───────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portfolio-media',
  'portfolio-media',
  true,
  52428800,  -- 50 MB
  ARRAY[
    'image/jpeg','image/jpg','image/png','image/webp','image/heic',
    'video/mp4','video/mov','video/quicktime','video/webm'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "portfolio_media_upload"     ON storage.objects;
DROP POLICY IF EXISTS "portfolio_media_read"       ON storage.objects;
DROP POLICY IF EXISTS "portfolio_media_delete_own" ON storage.objects;

CREATE POLICY "portfolio_media_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'portfolio-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "portfolio_media_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'portfolio-media');

CREATE POLICY "portfolio_media_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'portfolio-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── chat-media ────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  false,
  52428800,  -- 50 MB
  ARRAY[
    'image/jpeg','image/jpg','image/png','image/gif','image/webp','image/heic',
    'video/mp4','video/mov','video/quicktime','video/mpeg','video/webm'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat_media_upload" ON storage.objects;
DROP POLICY IF EXISTS "chat_media_read"   ON storage.objects;

CREATE POLICY "chat_media_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "chat_media_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-media');

-- ── chat-audio ────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-audio',
  'chat-audio',
  false,
  5242880,   -- 5 MB
  ARRAY['audio/m4a','audio/mp4','audio/aac','audio/mpeg','audio/webm']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat_audio_upload" ON storage.objects;
DROP POLICY IF EXISTS "chat_audio_read"   ON storage.objects;

CREATE POLICY "chat_audio_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-audio' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "chat_audio_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-audio');
