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
  created_at: string;
  searchMatch?: string;
  inventory: { quantity_available: number; unit_price_kobo: number; currency: string } | null;
  businesses: { name: string; city: string; region: string | null; country: string; slug: string } | null;
};

export type ProductQueryResult = { products: PublicProduct[]; error: string | null };

export function dedupePublicListings(products: PublicProduct[]) {
  const seen = new Set<string>();
  return products.filter((product) => {
    const key = [
      product.business_id,
      product.category_id,
      product.name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(),
      product.brand?.toLowerCase().trim() ?? "",
      product.condition,
      product.specifications?.toLowerCase().trim() ?? "",
      product.inventory?.currency ?? "",
      product.inventory?.unit_price_kobo ?? "",
      product.inventory?.quantity_available ?? "",
    ].join("\u001f");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rankProducts(
  products: PublicProduct[],
  search: string,
  filters?: { categoryId?: string; country?: string; city?: string },
): PublicProduct[] {
  const normalize = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const query = normalize(search);
  const terms = query.split(/\s+/).filter((term) => term.length > 1);
  const city = normalize(filters?.city ?? "");
  const country = filters?.country?.trim().toUpperCase() ?? "";

  return products.map((product) => {
    const name = normalize(product.name);
    const brand = normalize(product.brand ?? "");
    const specifications = normalize(product.specifications ?? "");
    const business = product.businesses;
    const businessCity = normalize(business?.city ?? "");
    let score = 0;
    let searchMatch: string | undefined;

    if (query && name === query) { score += 120; searchMatch = "Exact product match"; }
    else if (query && name.includes(query)) { score += 90; searchMatch = "Product name match"; }

    const nameHits = terms.filter((term) => name.includes(term)).length;
    const brandHits = terms.filter((term) => brand.includes(term)).length;
    const specificationHits = terms.filter((term) => specifications.includes(term)).length;
    score += nameHits * 18 + brandHits * 10 + specificationHits * 5;
    if (!searchMatch && nameHits) searchMatch = "Product name match";
    if (!searchMatch && brandHits) searchMatch = "Brand match";
    if (!searchMatch && specificationHits) searchMatch = "Specification match";

    if (filters?.categoryId && product.category_id === filters.categoryId) {
      score += 12;
      searchMatch ??= "Category match";
    }
    if (city && businessCity) {
      if (businessCity === city) { score += 30; searchMatch = "In your city"; }
      else if (businessCity.includes(city)) { score += 18; searchMatch ??= "Near your city"; }
    }
    if (country && business?.country.toUpperCase() === country) {
      score += 10;
      searchMatch ??= "In your country";
    }

    const quantity = Math.max(0, product.inventory?.quantity_available ?? 0);
    score += Math.min(Math.log2(quantity + 1) * 2, 10);

    return { product, score, searchMatch };
  }).sort((left, right) => right.score - left.score
    || Date.parse(right.product.created_at) - Date.parse(left.product.created_at))
    .map(({ product, searchMatch }) => ({ ...product, searchMatch }));
}

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
    .select("id,name,brand,condition,specifications,image_path,business_id,category_id,created_at,inventory!inner(quantity_available,unit_price_kobo,currency),businesses!inner(name,city,region,country,slug)")
    .eq("is_active", true)
    .eq("visibility", "public")
    .not("image_path", "is", null)
    .gt("inventory.quantity_available", 0)
    .gt("inventory.unit_price_kobo", 0)
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
  const products = (data ?? []) as unknown as PublicProduct[];
  return { products: dedupePublicListings(rankProducts(products, safeSearch ?? "", filters)), error: null };
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
  const resultWithLogo = await supabase.from("businesses")
    .select("id,name,slug,country,region,city,area,description,logo_path,primary_category_id")
    .eq("verification_status", "approved")
    .eq("visibility", "public")
    .order("name")
    .limit(60);
  if (!resultWithLogo.error) return resultWithLogo.data ?? [];
  const fallback = await supabase.from("businesses")
    .select("id,name,slug,country,region,city,area,description,primary_category_id")
    .eq("verification_status", "approved")
    .eq("visibility", "public")
    .order("name")
    .limit(60);
  return (fallback.data ?? []).map((business) => ({ ...business, logo_path: null }));
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
