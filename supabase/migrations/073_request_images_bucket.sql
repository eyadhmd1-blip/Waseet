-- ============================================================
-- 073_request_images_bucket.sql
-- Creates the 'request-images' storage bucket used by the
-- client new-request screen when uploading illustrative photos.
-- Without this bucket uploads fail silently → image_urls = []
-- → provider detail sheet never shows any images.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'request-images',
  'request-images',
  true,
  10485760,   -- 10 MB per file
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated clients can upload only into their own folder
DROP POLICY IF EXISTS "request_images_upload" ON storage.objects;
CREATE POLICY "request_images_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'request-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone (including providers) can read request images
DROP POLICY IF EXISTS "request_images_read" ON storage.objects;
CREATE POLICY "request_images_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'request-images');

-- Clients can delete only their own images
DROP POLICY IF EXISTS "request_images_delete_own" ON storage.objects;
CREATE POLICY "request_images_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'request-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
