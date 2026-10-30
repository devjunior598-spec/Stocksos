import type { MetadataRoute } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const staticRoutes = ["/", "/find-stock", "/suppliers", "/categories", "/how-it-works", "/about", "/contact", "/pricing"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://stocksos-7k4m2p9x.vercel.app";
  const supabase = await createSupabaseServerClient();
  const entries: MetadataRoute.Sitemap = staticRoutes.map((path) => ({ url: `${base}${path}`, changeFrequency: "daily", priority: path === "/" ? 1 : 0.6 }));
  if (!supabase) return entries;
  const [{ data: businesses }, { data: products }] = await Promise.all([
    supabase.from("businesses").select("slug,updated_at").eq("verification_status", "approved").eq("visibility", "public"),
    supabase.from("products").select("id,updated_at,businesses!inner(verification_status,visibility),inventory!inner(quantity_available)").eq("is_active", true).eq("visibility", "public").eq("businesses.verification_status", "approved").eq("businesses.visibility", "public").gt("inventory.quantity_available", 0),
  ]);
  for (const business of businesses ?? []) entries.push({ url: `${base}/business/${business.slug}`, lastModified: business.updated_at, changeFrequency: "daily", priority: 0.7 });
  for (const product of products ?? []) entries.push({ url: `${base}/product/${product.id}`, lastModified: product.updated_at, changeFrequency: "daily", priority: 0.8 });
  return entries;
}
