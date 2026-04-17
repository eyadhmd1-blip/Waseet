-- ============================================================
-- WASEET — Chat Media Support
-- v1.3 | April 2026
-- Extends messages table for audio and location messages
-- ============================================================

-- Add new msg_type values
ALTER TYPE msg_type ADD VALUE IF NOT EXISTS 'audio';
ALTER TYPE msg_type ADD VALUE IF NOT EXISTS 'location';

-- Add media columns to messages
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS audio_url   TEXT,
  ADD COLUMN IF NOT EXISTS duration_ms INT,          -- audio duration in milliseconds
  ADD COLUMN IF NOT EXISTS latitude    NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS longitude   NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS location_label TEXT;      -- reverse-geocoded label (optional)

-- Storage bucket for audio files (run after creating bucket in dashboard)
-- Bucket name: chat-audio
-- Policy: authenticated users can upload to their own folder, all job participants can read

-- INSERT policy: authenticated can upload to their own folder
-- Format: chat-audio/<user_id>/<filename>
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-audio',
  'chat-audio',
  false,
  5242880,   -- 5 MB max per file
  ARRAY['audio/m4a', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/webm']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "chat_audio_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-audio' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "chat_audio_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-audio');
