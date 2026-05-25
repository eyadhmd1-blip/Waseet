'use server';

// BUG-008 FIX: Centralised session guard for all server actions.
// Every mutating server action must call requireAdminSession() as its very first
// statement. This prevents unauthenticated callers from executing privileged
// operations even if they know the server action endpoint URL.

import { cookies } from 'next/headers';
import { verifyToken } from './token';

const COOKIE_NAME = 'waseet_admin_session';

/**
 * Throws an error if the request does not carry a valid admin session cookie.
 * Returns the decoded username so callers can use it for audit logging.
 */
export async function requireAdminSession(): Promise<string> {
  const jar   = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  const result = token ? await verifyToken(token) : { valid: false, username: undefined };

  if (!result.valid || !result.username) {
    throw new Error('UNAUTHORIZED');
  }

  return result.username;
}
