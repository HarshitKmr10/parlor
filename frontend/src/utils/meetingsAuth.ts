// Meeting-joiner dashboard auth — standalone from the rest of the app.
// One hardcoded user, server-side verified, HMAC-signed httpOnly cookie.
// All exports run server-side only; do NOT import this file from client code.
//
// Why hardcoded: the dashboard is an internal tool with a single allowed
// operator. Plumbing through Supabase / the existing user system would couple
// it to org-module config that doesn't apply here. The credentials never
// reach the client because they live in this server-only module.

const TEXT_ENCODER = new TextEncoder();

// Hardcoded credentials. Server-only — this file is never bundled for the
// browser because it's only imported from API routes and middleware.
export const MEETINGS_DASHBOARD_USER = 'super.admin@enterprise.com';
export const MEETINGS_DASHBOARD_PASSWORD = 'SuperAdmin123!';

// Static signing secret. Rotating it invalidates every existing session.
// Treat as low-impact since this gates a single internal user; if you ever
// want to lift this beyond one user, swap in env-sourced KMS-managed material.
const SESSION_SIGNING_SECRET = 'mj-dash-2026-static-hmac-key-rotate-on-incident';

export const SESSION_COOKIE_NAME = 'meetings_session';
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Constant-time string compare so password checks don't leak length/prefix.
export function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = TEXT_ENCODER.encode(a);
  const bBytes = TEXT_ENCODER.encode(b);
  // XOR every byte we can; differing lengths still resolve in constant time
  // by comparing against the longer one's length.
  const len = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i += 1) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

async function importHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    TEXT_ENCODER.encode(SESSION_SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  // btoa is available in both Node (>=16) and Edge runtimes.
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    Math.ceil(b64url.length / 4) * 4,
    '=',
  );
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export interface SessionPayload {
  sub: string; // username
  exp: number; // ms epoch
}

// Sign a payload → "<base64url(json)>.<base64url(hmac)>"
export async function issueSession(payload: SessionPayload): Promise<string> {
  const json = JSON.stringify(payload);
  const payloadB64 = bytesToBase64Url(TEXT_ENCODER.encode(json));
  const key = await importHmacKey();
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, TEXT_ENCODER.encode(payloadB64)),
  );
  const sigB64 = bytesToBase64Url(sig);
  return `${payloadB64}.${sigB64}`;
}

// Verify a signed cookie value. Returns the payload if valid + unexpired.
export async function verifySession(token: string | null | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  let sigBytes: Uint8Array;
  try {
    sigBytes = base64UrlToBytes(sigB64);
  } catch {
    return null;
  }
  const key = await importHmacKey();
  // Slice into a fresh ArrayBuffer so the BufferSource type accepts it
  // regardless of whether `sigBytes.buffer` was tagged ArrayBuffer or
  // SharedArrayBuffer by the runtime.
  const sigBuf = sigBytes.buffer.slice(
    sigBytes.byteOffset,
    sigBytes.byteOffset + sigBytes.byteLength,
  ) as ArrayBuffer;
  const ok = await crypto.subtle.verify('HMAC', key, sigBuf, TEXT_ENCODER.encode(payloadB64));
  if (!ok) return null;
  let parsed: SessionPayload;
  try {
    parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64)));
  } catch {
    return null;
  }
  if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null;
  if (typeof parsed.sub !== 'string' || parsed.sub.length === 0) return null;
  return parsed;
}
