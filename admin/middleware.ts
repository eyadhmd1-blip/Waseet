import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './app/lib/token';

const COOKIE_NAME  = 'waseet_admin_session';
const PUBLIC_PATHS = ['/login', '/_next', '/favicon.ico', '/p/', '/.well-known/'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const { valid, username } = await verifyToken(token);
  const expectedUser = process.env.ADMIN_USERNAME;

  if (!valid || !username || !expectedUser || username !== expectedUser) {
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.delete(COOKIE_NAME);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
