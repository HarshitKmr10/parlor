import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

const PUBLIC_PATHS = [
  "",
  "/login",
  "/signup",
  "/developers",
  "/developers/guides/quickstart",
  "/developers/guides/botless-capture",
  "/developers/guides/mock-mode-and-ask",
  "/developers/guides/mcp-server",
  "/developers/guides/webhooks",
  "/developers/guides/export",
  "/developers/guides/rate-limits-and-quotas",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PUBLIC_PATHS.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path.startsWith("/developers") ? "monthly" : "weekly",
    priority: path === "" ? 1 : path.startsWith("/developers") ? 0.5 : 0.7,
  }));
}
