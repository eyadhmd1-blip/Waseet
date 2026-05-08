-- Migration 062 — Add performed_by to admin_audit_log
-- Stores the admin username who performed each audited action.

ALTER TABLE admin_audit_log
  ADD COLUMN IF NOT EXISTS performed_by TEXT;

COMMENT ON COLUMN admin_audit_log.performed_by IS 'Admin username from session cookie who performed this action';
