import type { MetadataRoute } from "next";
import { PUBLIC_SITE_ORIGIN } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = PUBLIC_SITE_ORIGIN;
  return { rules: [{ userAgent: "*", allow: ["/", "/business/", "/product/"], disallow: ["/api/", "/admin/", "/dashboard/", "/supplier/", "/onboarding", "/login", "/register", "/forgot-password", "/reset-password", "/orders/"] }], sitemap: `${base}/sitemap.xml` };
}
