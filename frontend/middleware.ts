// Next.js middleware. Server-side, runs before page rendering.
//
// Currently scoped to the meeting-joiner dashboard at /meetings/*. Validates
// the HMAC-signed `meetings_session` cookie and redirects unauthenticated
// requests to /meetings/login. Login page + auth API route are excluded so
// they remain reachable.

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, SESSION_COOKIE_NAME } from '@/utils/meetingsAuth';

// Next.js matcher gotcha: `/meetings/:path*` does NOT match the bare
// `/meetings` path — `:path*` requires the leading slash even though `*`
// allows zero matches. We list both explicitly so a direct visit to
// `https://demo.futurepath.ai/meetings` (without /login or any subpath)
// is intercepted and bounced to the login page.
export const config = {
  matcher: ['/meetings', '/meetings/:path*'],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Login page itself must always be reachable so users have somewhere to
  // authenticate. Same goes for any API auth endpoint that lives under
  // /api/* (already excluded by the matcher pattern).
  if (pathname === '/meetings/login' || pathname.startsWith('/meetings/login/')) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
  const session = await verifySession(token);
  if (session) return NextResponse.next();

  // Bounce to login, preserving the intended destination as `next=`.
  const loginUrl = new URL('/meetings/login', req.url);
  loginUrl.searchParams.set('next', pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}
