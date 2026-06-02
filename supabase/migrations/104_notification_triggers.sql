-- ============================================================
-- Migration 104: Server-side notification triggers
--
-- Moves notification sending from client app → DB triggers.
-- Guarantees notifications are sent regardless of app/network
-- state. Both triggers call the existing Edge Functions using
-- the service_role key so no app-side call is required.
--
-- Affects:
--   bids    INSERT → notify-client-new-bid
--   requests INSERT → notify-new-request (non-urgent only)
-- ============================================================

-- ── 1. Trigger function: notify client on new bid ─────────────

CREATE OR REPLACE FUNCTION _notify_on_new_bid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_url text := _get_waseet_config('app.settings.supabase_url');
  v_key text := _get_waseet_config('app.settings.service_role_key');
BEGIN
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_new_bid ON bids;
CREATE TRIGGER trg_notify_on_new_bid
  AFTER INSERT ON bids
  FOR EACH ROW
  EXECUTE FUNCTION _notify_on_new_bid();

-- ── 2. Trigger function: notify providers on new request ──────

CREATE OR REPLACE FUNCTION _notify_on_new_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_url text := _get_waseet_config('app.settings.supabase_url');
  v_key text := _get_waseet_config('app.settings.service_role_key');
BEGIN
  -- Urgent requests have their own notification flow (notify-urgent)
  IF NEW.is_urgent = TRUE THEN
    RETURN NEW;
  END IF;

  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/notify-new-request',
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_new_request ON requests;
CREATE TRIGGER trg_notify_on_new_request
  AFTER INSERT ON requests
  FOR EACH ROW
  EXECUTE FUNCTION _notify_on_new_request();
