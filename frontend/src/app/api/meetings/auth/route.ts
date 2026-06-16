// POST /api/meetings/auth          — login. Body { email, password }.
// DELETE /api/meetings/auth         — logout. Clears cookie.
//
// Session is an HMAC-signed cookie named `meetings_session`. The credentials
// live server-side in src/lib/meetingsAuth.ts and never reach the browser.

import { NextResponse } from 'next/server';
import {
  MEETINGS_DASHBOARD_USER,
  MEETINGS_DASHBOARD_PASSWORD,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  constantTimeEqual,
  issueSession,
} from '@/utils/meetingsAuth';

export const runtime = 'nodejs';

interface LoginBody {
  email?: unknown;
  password?: unknown;
}

export async function POST(req: Request) {
  let body: LoginBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  // Constant-time so attackers can't time-test individual fields.
  const emailOk = constantTimeEqual(email, MEETINGS_DASHBOARD_USER.toLowerCase());
  const passwordOk = constantTimeEqual(password, MEETINGS_DASHBOARD_PASSWORD);
  if (!emailOk || !passwordOk) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });
  }

  const expMs = Date.now() + SESSION_TTL_MS;
  const token = await issueSession({ sub: MEETINGS_DASHBOARD_USER, exp: expMs });

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expMs),
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  });
  return res;
}
