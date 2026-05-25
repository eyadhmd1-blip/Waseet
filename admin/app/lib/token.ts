// Pure token utilities — no 'use server', no next/headers.
// Safe to import from proxy.ts (Node.js runtime) and server actions alike.

const SESSION_MAX_AGE = 8 * 60 * 60;

async function sign(payload: string, secret: string): Promise<string> {
  const enc     = new TextEncoder();
  const keyData = enc.encode(secret);
  const key     = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function buildToken(username: string): Promise<string> {
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

    const expectedSig = await sign(payload, secret);
    if (expectedSig !== sig) return { valid: false };

    if (Math.floor(Date.now() / 1000) > parseInt(expiresAtStr, 10)) {
      return { valid: false };
    }

    return { valid: true, username };
  } catch {
    return { valid: false };
  }
}

function getSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!s) throw new Error('ADMIN_SESSION_SECRET env var is not set');
  return s;
}
