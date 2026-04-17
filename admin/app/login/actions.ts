'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Session duration: 8 hours
const SESSION_MAX_AGE = 8 * 60 * 60;
const COOKIE_NAME     = 'waseet_admin_session';

// ── HMAC-based token (no extra packages — uses Web Crypto API) ──

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
  const secret    = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? 'change-me';
  const issuedAt  = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + SESSION_MAX_AGE;
  const payload   = `${username}|${issuedAt}|${expiresAt}`;
  const sig       = await sign(payload, secret);
  return `${payload}|${sig}`;
}

export async function verifyToken(token: string): Promise<{ valid: boolean; username?: string }> {
  try {
    const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? 'change-me';
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
  const username = (formData.get('username') as string ?? '').trim();
  const password = formData.get('password') as string ?? '';

  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;

  if (!expectedUser || !expectedPass) {
    redirect('/login?error=config');
  }

  if (username !== expectedUser || password !== expectedPass) {
    redirect('/login?error=invalid');
  }

  const token = await buildToken(username);
  const jar   = await cookies();

  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
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
