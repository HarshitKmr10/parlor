const FALLBACK = "http://localhost:3000";

export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return FALLBACK;
  return raw.replace(/\/+$/, "");
}
