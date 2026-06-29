import type { NextConfig } from "next";
import path from "node:path";

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
};

export default nextConfig;
