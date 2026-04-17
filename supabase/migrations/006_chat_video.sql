-- ============================================================
-- WASEET — Chat Image & Video Support
-- v1.4 | April 2026
-- Adds video message type and chat-media storage bucket
-- (image_url + 'image' enum value already exist from v1.0)
-- ============================================================

-- Add video msg_type
ALTER TYPE msg_type ADD VALUE IF NOT EXISTS 'video';

-- Add video_url column to messages
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Storage bucket for chat images and videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  false,
  52428800,  -- 50 MB max per file
  ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
    'video/mp4', 'video/mov', 'video/quicktime', 'video/mpeg', 'video/webm'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Upload policy: authenticated users upload to their own folder
-- Format: chat-media/<user_id>/<filename>
CREATE POLICY "chat_media_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read policy: any authenticated user who is a job participant can read
CREATE POLICY "chat_media_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-media');
