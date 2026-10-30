import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMarketplaceImagePath } from "@/lib/image-path";

export type Category = { id: string; name: string; slug: string };
export type PublicProduct = {
  id: string;
  name: string;
  brand: string | null;
  condition: string;
  specifications: string | null;
  image_path: string | null;
  business_id: string;
  category_id: string;
  inventory: { quantity_available: number; unit_price_kobo: number; currency: string } | null;
  businesses: { name: string; city: string; region: string | null; country: string; slug: string } | null;
};

export type ProductQueryResult = { products: PublicProduct[]; error: string | null };

export async function getCategories(): Promise<Category[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("categories").select("id, name, slug").eq("is_active", true).order("sort_order");
  return (data ?? []) as Category[];
}

export async function getProducts(
  search?: string,
  filters?: { categoryId?: string; country?: string; city?: string; minPriceKobo?: number; maxPriceKobo?: number },
): Promise<PublicProduct[]> {
  const result = await getProductsResult(search, filters);
  return result.products;
}

export async function getProductsResult(
  search?: string,
  filters?: { categoryId?: string; country?: string; city?: string; minPriceKobo?: number; maxPriceKobo?: number },
  limit = 40,
): Promise<ProductQueryResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { products: [], error: "Supabase is not configured for this deployment." };
  let query = supabase.from("products")
    .select("id,name,brand,condition,specifications,image_path,business_id,category_id,inventory!inner(quantity_available,unit_price_kobo,currency),businesses!inner(name,city,region,country,slug)")
    .eq("is_active", true)
    .eq("visibility", "public")
    .gt("inventory.quantity_available", 0)
    .eq("businesses.verification_status", "approved")
    .eq("businesses.visibility", "public")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(Math.trunc(limit), 1), 40));
  const safeSearch = search?.trim().replace(/[^a-z0-9\s-]/gi, "").slice(0, 80);
  if (safeSearch) query = query.or("name.ilike.%" + safeSearch + "%,brand.ilike.%" + safeSearch + "%,specifications.ilike.%" + safeSearch + "%");
  if (filters?.categoryId) query = query.eq("category_id", filters.categoryId);
  const safeCountry = filters?.country?.trim().toUpperCase();
  if (safeCountry && /^[A-Z]{2}$/.test(safeCountry)) query = query.eq("businesses.country", safeCountry);
  const safeCity = filters?.city?.trim().replace(/[^a-z\s-]/gi, "").slice(0, 60);
  if (safeCity) query = query.ilike("businesses.city", "%" + safeCity + "%");
  if (typeof filters?.minPriceKobo === "number") query = query.gte("inventory.unit_price_kobo", filters.minPriceKobo);
  if (typeof filters?.maxPriceKobo === "number") query = query.lte("inventory.unit_price_kobo", filters.maxPriceKobo);
  const { data, error } = await query;
  if (error) {
    console.error("Marketplace product search failed", { code: error.code, message: error.message });
    return { products: [], error: "Live stock search is temporarily unavailable. Please try again shortly." };
  }
  return { products: (data ?? []) as unknown as PublicProduct[], error: null };
}

export function getMarketplaceImageUrl(path: string | null | undefined) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !path || !isMarketplaceImagePath(path)) return null;
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/marketplace-images/${encodedPath}`;
}

export async function getPublicBusinesses() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("businesses")
    .select("id,name,slug,country,region,city,area,description,primary_category_id")
    .eq("verification_status", "approved")
    .eq("visibility", "public")
    .order("name")
    .limit(60);
  return data ?? [];
}

export function formatMoney(kobo: number | string | null | undefined, currency = "USD") {
  const value = Number(kobo ?? 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
