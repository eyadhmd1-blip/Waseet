'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

// Session duration: 8 hours
const SESSION_MAX_AGE = 8 * 60 * 60;
const COOKIE_NAME     = 'waseet_admin_session';

// ── Brute-force protection ───────────────────────────────────────
// In-memory per-IP counters. Resets on cold start but covers the
// vast majority of real attacks which are rapid and continuous.
const MAX_ATTEMPTS      = 5;
const LOCKOUT_MS        = 15 * 60 * 1000; // 15 minutes

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
  // Lockout expired — reset
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

// ── HMAC-based token (no extra packages — uses Web Crypto API) ──

function getSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!s) throw new Error('ADMIN_SESSION_SECRET env var is not set');
  return s;
}

async function sign(payload: string, secret: string): Promise<string> {
  const enc     = new TextEncoder();
  const keyData = enc.encode(secret);
  const key     = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig     = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Buffer.from(sig).toString('hex');
}

async function buildToken(username: string): Promise<string> {
  const secret    = getSecret();
  const issuedAt  = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + SESSION_MAX_AGE;
  const payload   = `${username}|${issuedAt}|${expiresAt}`;
  const sig       = await sign(payload, secret);
  return `${payload}|${sig}`;
}

export async function verifyToken(token: string): Promise<{ valid: boolean; username?: string }> {
  try {
    const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
    if (!secret) return { valid: false };
    const parts  = token.split('|');
    if (parts.length !== 4) return { valid: false };

    const [username, , expiresAtStr, sig] = parts;
    const payload = parts.slice(0, 3).join('|');

    // Verify signature
    const expectedSig = await sign(payload, secret);
    if (expectedSig !== sig) return { valid: false };

    // Check expiry
    if (Math.floor(Date.now() / 1000) > parseInt(expiresAtStr, 10)) {
      return { valid: false };
    }

    return { valid: true, username };
  } catch {
    return { valid: false };
  }
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
