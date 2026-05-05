-- ============================================================
-- Migration 054: Replace discount system with bid-credit rewards
--
-- Old system: win_discount_pct, loyalty_discount, REP_DISCOUNT
--   → gave % off next subscription renewal (abstract, deferred)
-- New system: award bid_credits directly on achievement events
--   → tangible, immediate, drives engagement loop
--
-- Credit events:
--   • Job confirmed by client      → +2 credits  (replaces win_discount +3%)
--   • Reputation tier upgrade      → bonus credits per tier
--   • Loyalty milestone (10 jobs)  → +15 credits  (replaces 20% loyalty discount)
--   • Loyalty milestone (25 jobs)  → +30 credits  (replaces 30% loyalty discount)
--   • 5-star rating received       → +1 credit
-- ============================================================

-- ── 1. Drop old win-discount trigger & function ───────────────

DROP TRIGGER  IF EXISTS trg_award_win_discount     ON jobs;
DROP FUNCTION IF EXISTS trg_fn_award_win_discount();
DROP FUNCTION IF EXISTS award_win_renewal_discount(UUID);

-- ── 2. Zero out legacy discount columns ──────────────────────
-- Keep columns in schema (non-destructive) but clear values so
-- the old UI sections never show stale data.

UPDATE providers
SET win_discount_pct = 0,
    loyalty_discount = 0
WHERE win_discount_pct > 0 OR loyalty_discount > 0;

-- ── 3. award_bid_credits_on_job_done ─────────────────────────
-- Fires when client confirms a job → provider earns +2 credits.
-- Replaces the old award_win_renewal_discount logic.

CREATE OR REPLACE FUNCTION award_bid_credits_on_job_done()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.confirmed_by_client = true AND OLD.confirmed_by_client = false THEN
    UPDATE providers
    SET bid_credits = bid_credits + 2
    WHERE id = NEW.provider_id
      AND subscription_tier != 'premium';  -- premium is unlimited, no need to top-up
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_credits_job_done ON jobs;
CREATE TRIGGER trg_award_credits_job_done
  AFTER UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION award_bid_credits_on_job_done();

-- ── 4. award_tier_upgrade_credits ────────────────────────────
-- Fires when a provider's reputation_tier increases.
-- New tier bonuses:  rising=5, trusted=10, expert=15, elite=25

CREATE OR REPLACE FUNCTION award_tier_upgrade_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_bonus INT := 0;
BEGIN
  IF NEW.reputation_tier = OLD.reputation_tier THEN
    RETURN NEW;
  END IF;

  v_bonus := CASE NEW.reputation_tier
    WHEN 'rising'  THEN 5
    WHEN 'trusted' THEN 10
    WHEN 'expert'  THEN 15
    WHEN 'elite'   THEN 25
    ELSE 0
  END;

  IF v_bonus > 0 AND NEW.subscription_tier != 'premium' THEN
    NEW.bid_credits := NEW.bid_credits + v_bonus;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_tier_upgrade_credits ON providers;
CREATE TRIGGER trg_award_tier_upgrade_credits
  BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION award_tier_upgrade_credits();

-- ── 5. award_milestone_credits ───────────────────────────────
-- Fires when lifetime_jobs crosses 10 or 25.
-- Replaces the old loyalty_discount milestones.

CREATE OR REPLACE FUNCTION award_milestone_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_bonus INT := 0;
BEGIN
  IF NEW.lifetime_jobs = OLD.lifetime_jobs THEN
    RETURN NEW;
  END IF;

  -- Award once per milestone (OLD < threshold AND NEW >= threshold)
  IF OLD.lifetime_jobs < 10 AND NEW.lifetime_jobs >= 10 THEN
    v_bonus := v_bonus + 15;
  END IF;

  IF OLD.lifetime_jobs < 25 AND NEW.lifetime_jobs >= 25 THEN
    v_bonus := v_bonus + 30;
  END IF;

  IF v_bonus > 0 AND NEW.subscription_tier != 'premium' THEN
    NEW.bid_credits := NEW.bid_credits + v_bonus;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_milestone_credits ON providers;
CREATE TRIGGER trg_award_milestone_credits
  BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION award_milestone_credits();

-- ── 6. award_five_star_credit ─────────────────────────────────
-- Fires when a job gets a 5-star rating for the provider.

CREATE OR REPLACE FUNCTION award_five_star_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.provider_rating = 5 AND (OLD.provider_rating IS NULL OR OLD.provider_rating < 5) THEN
    UPDATE providers
    SET bid_credits = bid_credits + 1
    WHERE id = NEW.provider_id
      AND subscription_tier != 'premium';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_five_star_credit ON jobs;
CREATE TRIGGER trg_award_five_star_credit
  AFTER UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION award_five_star_credit();

-- ── 7. Update activate_provider_subscription ─────────────────
-- Remove discount resets — no longer needed.
-- Also remove loyalty_discount and win_discount_pct resets.

CREATE OR REPLACE FUNCTION activate_provider_subscription(
  p_provider_id   UUID,
  p_tier          TEXT,
  p_period_months INT DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_credits INT;
BEGIN
  v_credits := CASE p_tier
    WHEN 'trial'   THEN 10
    WHEN 'basic'   THEN 20
    WHEN 'pro'     THEN 50
    WHEN 'premium' THEN 0   -- unlimited sentinel
    ELSE 20
  END;

  UPDATE providers SET
    is_subscribed     = true,
    subscription_tier = p_tier,
    subscription_ends = NOW() + (p_period_months || ' months')::INTERVAL,
    bid_credits       = bid_credits + v_credits,  -- ADD to existing balance
    trial_used        = CASE WHEN p_tier = 'trial' THEN true ELSE trial_used END,
    win_discount_pct  = 0,
    loyalty_discount  = 0
  WHERE id = p_provider_id;
END;
$$;
