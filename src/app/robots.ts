import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/url";

const baseUrl = getBaseUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/ops/", "/editor", "/editor/", "/api/", "/account", "/upgrade", "/billing/"] },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
