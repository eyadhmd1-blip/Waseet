import { cookies } from 'next/headers';

const COOKIE_NAME = 'waseet_admin_session';

export async function getAdminUsername(): Promise<string> {
  try {
    const jar   = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return 'unknown';
    const parts = token.split('|');
    return parts[0] || 'unknown';
  } catch {
    return 'unknown';
  }
}
