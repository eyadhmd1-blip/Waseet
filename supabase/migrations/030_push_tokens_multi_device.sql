-- ============================================================
-- Migration 030 — push_tokens multi-device support
-- Replaces the single-token-per-user constraint with a
-- composite unique key (user_id, token) so that one user
-- can have push tokens from multiple devices (phone + tablet).
-- ============================================================

-- Drop old single-user unique constraint
ALTER TABLE push_tokens DROP CONSTRAINT IF EXISTS push_tokens_user_id_key;

-- Add composite unique constraint: one row per (user, token) pair
ALTER TABLE push_tokens
  ADD CONSTRAINT push_tokens_user_token_key UNIQUE (user_id, token);

-- Index on token alone for fast lookups during fan-out sends
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);
