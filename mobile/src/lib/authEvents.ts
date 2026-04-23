/**
 * Thin event bridge so screens outside _layout.tsx can push a known role
 * directly into the root route guard without waiting for onAuthStateChange.
 *
 * Usage:
 *   notifyRoleUpdate('client')   — call from onboarding after inserting users row
 *   setRoleUpdateHandler(fn)     — call once from RootLayoutInner
 */

type Role = 'client' | 'provider' | 'onboarding' | 'unverified' | null;
type Handler = (role: Role) => void;

let _handler: Handler | null = null;

export function setRoleUpdateHandler(fn: Handler): void {
  _handler = fn;
}

export function notifyRoleUpdate(role: Role): void {
  _handler?.(role);
}
