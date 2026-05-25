-- ============================================================
-- Migration 099 — Hide suspended providers from public profiles view
--
-- public_provider_profiles only filtered on show_public = TRUE,
-- allowing suspended providers to remain visible on their public
-- profile pages. Adding AND u.is_suspended = FALSE ensures
-- suspended providers are hidden from all public-facing surfaces.
-- ============================================================

CREATE OR REPLACE VIEW public_provider_profiles
  WITH (security_invoker = true)
AS
SELECT
  pr.id,
  pr.username,
  pr.score,
  pr.reputation_tier,
  pr.lifetime_jobs,
  pr.badge_verified,
  pr.share_count,
  pr.profile_views,
  pr.categories,
  pr.bio,
  u.full_name,
  u.city,
  u.is_suspended
FROM providers pr
JOIN users u ON u.id = pr.id
WHERE pr.show_public = TRUE
  AND u.is_suspended = FALSE;
