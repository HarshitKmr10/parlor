import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/meetings",
        "/ask",
        "/search",
        "/action-items",
        "/highlights",
        "/integrations",
        "/reports",
        "/trackers",
        "/settings",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
