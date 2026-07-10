import type { NextConfig } from "next";
import path from "node:path";

// Browser-facing backend origin (OAuth redirects, client fetches). Falls
// back to the same dev default used by lib/api/config.ts's
// PUBLIC_API_BASE_URL so connect-src stays in sync with the actual backend
// the frontend talks to.
const backendOrigin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const contentSecurityPolicy = [
  "default-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  `connect-src 'self' ${backendOrigin}`,
].join("; ");

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker
  // runtime image needs only Node + the traced files, not the full repo.
  output: "standalone",
  // Pin the workspace root. The repo path contains a space and sits below
  // other lockfiles, so Turbopack mis-infers the root and panics with
  // "Next.js package not found". Anchoring it here keeps dev/build stable.
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
