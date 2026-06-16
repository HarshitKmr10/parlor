import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker
  // runtime image needs only Node + the traced files, not the full repo.
  output: "standalone",
};

export default nextConfig;
