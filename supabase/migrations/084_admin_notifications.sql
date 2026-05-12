-- ============================================================
-- Migration 084: Admin Notification System
-- ============================================================
-- Wires up 9 admin notification events:
--   Immediate (DB triggers → Edge Function via pg_net):
--     1. cliq_payment          — INSERT on support_tickets WHERE category='payment'
--     2. urgent_ticket         — INSERT on support_tickets WHERE priority='urgent' AND category!='payment'
--     3. abuse_report_critical — INSERT on reports WHERE report_type IN ('abusive','no_show')
--     4. provider_flag_new     — INSERT on provider_flags
--     5. cancellation_abuse    — INSERT on admin_alerts WHERE alert_type='cancellation_abuse'
--
--   Scheduled (pg_cron → Edge Function):
--     6. urgent_no_bids  — every 30 min
--     7. normal_tickets  — every 1 h
--     8. reports_batch   — every 2 h
--     9. daily_digest    — daily 05:00 UTC (08:00 Amman)
--
-- Tracking columns added to avoid duplicate scheduled notifications:
--   requests.admin_urgency_notified_at
--   support_tickets.admin_notified_at
--   reports.admin_notified_at
-- ============================================================

-- ─── 1. Tracking columns ─────────────────────────────────────

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS admin_urgency_notified_at TIMESTAMPTZ;

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS admin_notified_at TIMESTAMPTZ;

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS admin_notified_at TIMESTAMPTZ;

-- ─── 2. Core helper: invoke notify-admin edge function ────────

CREATE OR REPLACE FUNCTION invoke_notify_admin(
  p_event   TEXT,
  p_payload JSONB DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := current_setting('app.settings.supabase_url',     true);
  v_key text := current_setting('app.settings.service_role_key', true);
BEGIN
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'notify-admin: supabase_url or service_role_key not configured — skipping (event: %)', p_event;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/notify-admin',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    := jsonb_build_object('event', p_event, 'data', p_payload)
  );
END;
$$;

-- ─── 3. Trigger: CliQ payment ticket ─────────────────────────

CREATE OR REPLACE FUNCTION _trg_notify_admin_cliq_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.category = 'payment' THEN
    PERFORM invoke_notify_admin('cliq_payment', jsonb_build_object(
      'ticket_id',  NEW.id,
      'user_id',    NEW.user_id,
      'subject',    NEW.subject,
      'plan_tier',  NEW.plan_tier,
      'amount_jod', NEW.plan_amount_jod,
      'opened_at',  NEW.opened_at
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_cliq_payment ON support_tickets;
CREATE TRIGGER trg_notify_admin_cliq_payment
  AFTER INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION _trg_notify_admin_cliq_payment();

-- ─── 4. Trigger: Urgent support ticket (non-payment) ─────────

CREATE OR REPLACE FUNCTION _trg_notify_admin_urgent_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.priority = 'urgent' AND NEW.category != 'payment' THEN
    PERFORM invoke_notify_admin('urgent_ticket', jsonb_build_object(
      'ticket_id', NEW.id,
      'user_id',   NEW.user_id,
      'subject',   NEW.subject,
      'category',  NEW.category,
      'opened_at', NEW.opened_at
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_urgent_ticket ON support_tickets;
CREATE TRIGGER trg_notify_admin_urgent_ticket
  AFTER INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION _trg_notify_admin_urgent_ticket();

-- ─── 5. Trigger: Critical abuse report ───────────────────────

CREATE OR REPLACE FUNCTION _trg_notify_admin_abuse_critical()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.report_type IN ('abusive', 'no_show') THEN
    PERFORM invoke_notify_admin('abuse_report_critical', jsonb_build_object(
      'report_id',        NEW.id,
      'report_type',      NEW.report_type,
      'reporter_id',      NEW.reporter_id,
      'reported_user_id', NEW.reported_user_id,
      'description',      NEW.description,
      'created_at',       NEW.created_at
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_abuse_critical ON reports;
CREATE TRIGGER trg_notify_admin_abuse_critical
  AFTER INSERT ON reports
  FOR EACH ROW
  EXECUTE FUNCTION _trg_notify_admin_abuse_critical();

-- ─── 6. Trigger: New provider flag ───────────────────────────

CREATE OR REPLACE FUNCTION _trg_notify_admin_provider_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM invoke_notify_admin('provider_flag_new', jsonb_build_object(
    'flag_id',     NEW.id,
    'provider_id', NEW.provider_id,
    'reason',      NEW.reason,
    'details',     NEW.details,
    'created_at',  NEW.created_at
  ));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_provider_flag ON provider_flags;
CREATE TRIGGER trg_notify_admin_provider_flag
  AFTER INSERT ON provider_flags
  FOR EACH ROW
  EXECUTE FUNCTION _trg_notify_admin_provider_flag();

-- ─── 7. Trigger: Cancellation abuse alert ────────────────────

CREATE OR REPLACE FUNCTION _trg_notify_admin_cancellation_abuse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.alert_type = 'cancellation_abuse' THEN
    PERFORM invoke_notify_admin('cancellation_abuse', jsonb_build_object(
      'alert_id',   NEW.id,
      'user_id',    NEW.user_id,
      'message',    NEW.message,
      'metadata',   NEW.metadata,
      'created_at', NEW.created_at
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_cancellation_abuse ON admin_alerts;
CREATE TRIGGER trg_notify_admin_cancellation_abuse
  AFTER INSERT ON admin_alerts
  FOR EACH ROW
  EXECUTE FUNCTION _trg_notify_admin_cancellation_abuse();

-- ─── 8. pg_cron helpers ──────────────────────────────────────

CREATE OR REPLACE FUNCTION _invoke_notify_admin_cron(p_event TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url text := current_setting('app.settings.supabase_url',     true);
  v_key text := current_setting('app.settings.service_role_key', true);
BEGIN
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'notify-admin cron: settings not configured — skipping (event: %)', p_event;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/notify-admin',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    := jsonb_build_object('event', p_event, 'data', '{}')
  );
END;
$$;

-- Event 6: Urgent requests without bids — every 30 min

DO $$ BEGIN PERFORM cron.unschedule('notify-admin-urgent-no-bids'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'notify-admin-urgent-no-bids',
  '*/30 * * * *',
  $$SELECT _invoke_notify_admin_cron('urgent_no_bids')$$
);

-- Event 7: Normal support tickets — every 1 hour

DO $$ BEGIN PERFORM cron.unschedule('notify-admin-normal-tickets'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'notify-admin-normal-tickets',
  '0 * * * *',
  $$SELECT _invoke_notify_admin_cron('normal_tickets')$$
);

-- Event 8: Non-critical reports batch — every 2 hours

DO $$ BEGIN PERFORM cron.unschedule('notify-admin-reports-batch'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'notify-admin-reports-batch',
  '0 */2 * * *',
  $$SELECT _invoke_notify_admin_cron('reports_batch')$$
);

-- Event 9: Daily digest — 05:00 UTC (08:00 Amman)

DO $$ BEGIN PERFORM cron.unschedule('notify-admin-daily-digest'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'notify-admin-daily-digest',
  '0 5 * * *',
  $$SELECT _invoke_notify_admin_cron('daily_digest')$$
);

-- ─── 9. Grants ───────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION invoke_notify_admin(TEXT, JSONB)    TO service_role;
GRANT EXECUTE ON FUNCTION _invoke_notify_admin_cron(TEXT)     TO service_role;
