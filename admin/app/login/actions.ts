'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { buildToken, verifyToken } from '../lib/token';

export { verifyToken };

const SESSION_MAX_AGE = 8 * 60 * 60;
const COOKIE_NAME     = 'waseet_admin_session';

// ── Brute-force protection ───────────────────────────────────────
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 15 * 60 * 1000; // 15 minutes

interface Attempt { count: number; lockedUntil: number }
const loginAttempts = new Map<string, Attempt>();

function getClientIp(): string {
  const hdrs = headers() as unknown as { get: (k: string) => string | null };
  return (
    hdrs.get('x-forwarded-for')?.split(',')[0].trim() ??
    hdrs.get('x-real-ip') ??
    'unknown'
  );
}

function checkBruteForce(ip: string): boolean {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() < entry.lockedUntil) return true;
  loginAttempts.delete(ip);
  return false;
}

function recordFailure(ip: string): void {
  const entry = loginAttempts.get(ip) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  loginAttempts.set(ip, entry);
}

function resetAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

export async function loginAction(formData: FormData): Promise<void> {
  const ip = getClientIp();

  if (checkBruteForce(ip)) {
    redirect('/login?error=locked');
  }

  const username = (formData.get('username') as string ?? '').trim();
  const password = formData.get('password') as string ?? '';

  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;

  if (!expectedUser || !expectedPass) {
    redirect('/login?error=config');
  }

  if (username !== expectedUser || password !== expectedPass) {
    recordFailure(ip);
    redirect('/login?error=invalid');
  }

  resetAttempts(ip);
  const token = await buildToken(username);
  const jar   = await cookies();

  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   SESSION_MAX_AGE,
    path:     '/',
  });

  redirect('/');
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  redirect('/login');
}
