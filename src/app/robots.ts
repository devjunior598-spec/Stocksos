import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://stocksos-7k4m2p9x.vercel.app";
  return { rules: [{ userAgent: "*", allow: ["/", "/business/", "/product/"], disallow: ["/api/", "/admin/", "/dashboard/", "/supplier/", "/onboarding", "/login", "/register", "/forgot-password", "/reset-password", "/orders/"] }], sitemap: `${base}/sitemap.xml` };
}
