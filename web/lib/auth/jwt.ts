/**
 * Lightweight JWT payload decoding for expiry checks ONLY.
 *
 * This does NOT verify the signature — the backend is the authority on
 * validity. The web layer only needs to know whether the access token has
 * expired so it can proactively refresh. Edge-runtime safe (no Node Buffer).
 */

interface JwtPayload {
  exp?: number;
  sub?: string;
}

function base64UrlDecode(segment: string): string {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const normalized = padded + "=".repeat(padLength);
  if (typeof atob === "function") {
    return atob(normalized);
  }
  // Node fallback (route handlers may run on the node runtime).
  return Buffer.from(normalized, "base64").toString("binary");
}

function decodeJwt(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = base64UrlDecode(parts[1]);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Returns true when the token is missing, malformed, or expires within
 * `skewSec` seconds. Treats undecodable tokens as expired so we refresh.
 */
export function isTokenExpired(token: string | undefined, skewSec = 30): boolean {
  if (!token) return true;
  const payload = decodeJwt(token);
  if (!payload?.exp) return true;
  const nowSec = Math.floor(Date.now() / 1000);
  return payload.exp - skewSec <= nowSec;
}
