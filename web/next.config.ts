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
  // Constrain where <form> submissions can go; without this, form-action
  // falls back to default-src but is worth stating explicitly.
  "form-action 'self'",
  "script-src 'self'",
  // 'unsafe-inline' is required for Next.js's injected inline styles; tightening
  // this to a nonce would need a custom document/server render pass.
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
          // Isolate the browsing context so cross-origin windows/documents
          // can't reference this app's window or embed its resources.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
