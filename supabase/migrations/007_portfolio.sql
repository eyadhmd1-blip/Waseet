-- ============================================================
-- WASEET — Provider Portfolio / Gallery
-- v1.5 | April 2026
-- ============================================================

CREATE TABLE IF NOT EXISTS portfolio_items (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id    UUID        NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  category_slug  TEXT,
  title_ar       TEXT,
  description_ar TEXT,
  -- 'single'       → media_urls[0] is the image
  -- 'before_after' → media_urls[0]=before, media_urls[1]=after
  -- 'video'        → video_url is used, media_urls is empty
  item_type      TEXT        NOT NULL DEFAULT 'single'
                             CHECK (item_type IN ('single','before_after','video')),
  media_urls     TEXT[]      NOT NULL DEFAULT '{}',
  video_url      TEXT,
  is_verified_job BOOLEAN    NOT NULL DEFAULT false,
  job_id         UUID,                          -- optional link to a completed job
  views_count    INT         NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portfolio_read_all"
  ON portfolio_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "portfolio_insert_own"
  ON portfolio_items FOR INSERT TO authenticated
  WITH CHECK (provider_id = auth.uid());

CREATE POLICY "portfolio_delete_own"
  ON portfolio_items FOR DELETE TO authenticated
  USING (provider_id = auth.uid());

-- Index for fast per-provider queries
CREATE INDEX IF NOT EXISTS idx_portfolio_provider
  ON portfolio_items(provider_id, created_at DESC);

-- ── Storage bucket ────────────────────────────────────────────
-- Public bucket: images/videos are served directly (no signed URLs)
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

-- ── Increment view helper ─────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_portfolio_view(item_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE portfolio_items SET views_count = views_count + 1 WHERE id = item_id;
END;
$$;
