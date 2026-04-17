-- ============================================================
-- WASEET — Push Tokens Table
-- v1.2 | April 2026
-- ============================================================

CREATE TABLE push_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL,
  platform   TEXT        NOT NULL DEFAULT 'expo',   -- 'expo' | 'apns' | 'fcm'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)   -- one active token per user (upsert on login)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own token
CREATE POLICY "push_tokens_own" ON push_tokens
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);
