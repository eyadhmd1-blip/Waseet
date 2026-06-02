-- ============================================================
-- Migration 105: Notification triggers — hardening & completion
--
-- Builds on migration 104 to make server-side notifications the
-- single source of truth, professionally and safely:
--
--   1. EXCEPTION protection on ALL notification triggers so a
--      notification failure can NEVER roll back the core write
--      (bid / request / contract / job insert).
--   2. Route urgent requests → notify-urgent (104 skipped them).
--   3. New trigger: recurring_contracts INSERT → notify-contract.
--   4. New trigger: jobs INSERT → notify-providers-bid-rejected.
--
-- All HTTP calls use net.http_post (async; sent after COMMIT) with
-- the service_role key stored in _waseet_config.
-- ============================================================

-- ── 1. notify-client-new-bid (bids INSERT) — add EXCEPTION guard ──

CREATE OR REPLACE FUNCTION _notify_on_new_bid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  -- Notification must never block the bid insert: swallow ANY error.
  BEGIN
    v_url := _get_waseet_config('app.settings.supabase_url');
    v_key := _get_waseet_config('app.settings.service_role_key');
    IF v_url IS NULL OR v_key IS NULL THEN
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url     := v_url || '/functions/v1/notify-client-new-bid',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || v_key
                 ),
      body    := jsonb_build_object(
                   'request_id',  NEW.request_id::text,
                   'provider_id', NEW.provider_id::text
                 )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log a warning but allow the bid insert to commit.
    RAISE WARNING 'notify_on_new_bid failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ── 2. notify on new request (requests INSERT) — route urgent vs normal ──

CREATE OR REPLACE FUNCTION _notify_on_new_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_url      text;
  v_key      text;
  v_function text;
BEGIN
  BEGIN
    v_url := _get_waseet_config('app.settings.supabase_url');
    v_key := _get_waseet_config('app.settings.service_role_key');
    IF v_url IS NULL OR v_key IS NULL THEN
      RETURN NEW;
    END IF;

    -- Urgent requests use the dedicated urgent flow; normal ones the standard flow.
    IF NEW.is_urgent = TRUE THEN
      v_function := 'notify-urgent';
    ELSE
      v_function := 'notify-new-request';
    END IF;

    PERFORM net.http_post(
      url     := v_url || '/functions/v1/' || v_function,
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || v_key
                 ),
      body    := jsonb_build_object(
                   'request_id',    NEW.id::text,
                   'city',          NEW.city,
                   'category_slug', NEW.category_slug,
                   'client_id',     NEW.client_id::text
                 )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_on_new_request failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ── 3. notify-contract (recurring_contracts INSERT) ──────────────

CREATE OR REPLACE FUNCTION _notify_on_new_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  BEGIN
    -- Only freshly-posted contracts open for bidding should notify providers.
    IF NEW.status IS DISTINCT FROM 'bidding' THEN
      RETURN NEW;
    END IF;

    v_url := _get_waseet_config('app.settings.supabase_url');
    v_key := _get_waseet_config('app.settings.service_role_key');
    IF v_url IS NULL OR v_key IS NULL THEN
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url     := v_url || '/functions/v1/notify-contract',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || v_key
                 ),
      body    := jsonb_build_object(
                   'contract_id',   NEW.id::text,
                   'city',          NEW.city,
                   'category_slug', NEW.category_slug
                 )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_on_new_contract failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_new_contract ON recurring_contracts;
CREATE TRIGGER trg_notify_on_new_contract
  AFTER INSERT ON recurring_contracts
  FOR EACH ROW
  EXECUTE FUNCTION _notify_on_new_contract();

-- ── 4. notify-providers-bid-rejected (jobs INSERT) ───────────────
-- A job is created only by accept_bid(), which in the same transaction
-- rejects all other bids on the request. net.http_post fires after
-- COMMIT, so the rejected bids are visible when the function runs.

CREATE OR REPLACE FUNCTION _notify_on_job_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  BEGIN
    v_url := _get_waseet_config('app.settings.supabase_url');
    v_key := _get_waseet_config('app.settings.service_role_key');
    IF v_url IS NULL OR v_key IS NULL THEN
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url     := v_url || '/functions/v1/notify-providers-bid-rejected',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || v_key
                 ),
      body    := jsonb_build_object(
                   'request_id', NEW.request_id::text
                 )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_on_job_created failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_job_created ON jobs;
CREATE TRIGGER trg_notify_on_job_created
  AFTER INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION _notify_on_job_created();
