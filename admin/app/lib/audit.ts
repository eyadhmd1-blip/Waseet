import { supabaseAdmin } from './supabase';

export type AuditAction =
  | 'disable_user'
  | 'enable_user'
  | 'suspend_provider'
  | 'unsuspend_provider'
  | 'verify_provider'
  | 'unverify_provider'
  | 'override_tier'
  | 'close_request'
  | 'delete_request'
  | 'broadcast_notification'
  | 'update_setting';

export async function logAudit(params: {
  action:       AuditAction;
  target_type:  'user' | 'provider' | 'request' | 'contract' | 'system';
  target_id?:   string;
  target_label?: string;
  reason?:      string;
  metadata?:    Record<string, unknown>;
}): Promise<void> {
  try {
    await supabaseAdmin.from('admin_audit_log').insert({
      action:       params.action,
      target_type:  params.target_type,
      target_id:    params.target_id    ?? null,
      target_label: params.target_label ?? null,
      reason:       params.reason       ?? null,
      metadata:     params.metadata     ?? {},
    });
  } catch {
    // Non-blocking — never fail the primary action because of audit log
  }
}
