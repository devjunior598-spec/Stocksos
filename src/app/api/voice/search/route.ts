import { NextResponse } from "next/server";
import { z } from "zod";
import { formatMoney, getCategories, getProductsResult } from "@/lib/data";
import { parseSearchIntent } from "@/lib/search-intent";
import { getAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const requestSchema = z.object({ query: z.string().trim().min(2).max(180) });

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Send a product or stock request to search." }, { status: 400 }); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter at least two characters to search stock." }, { status: 400 });

  const categories = await getCategories();
  const user = await getAuthenticatedUser();
  let savedCity = "";
  let savedCountry = "";
  if (user) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase!.from("profiles").select("home_city,home_country").eq("id", user.id).maybeSingle();
    if (error) return NextResponse.json({ error: "Your saved location could not be loaded. Please try again." }, { status: 503 });
    savedCity = data?.home_city ?? "";
    savedCountry = data?.home_country ?? "";
  }
  let filters;
  try { filters = parseSearchIntent(parsed.data.query, categories, savedCity); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Please clarify your search." }, { status: 400 }); }
  const normalized = filters.q;
  if (!normalized) return NextResponse.json({ error: "Please mention the product you need." }, { status: 400 });
  const result = await getProductsResult(normalized, { categoryId: filters.category || undefined, country: savedCountry || undefined, city: filters.city, minPriceKobo: filters.min === undefined ? undefined : Math.round(filters.min * 100), maxPriceKobo: filters.max === undefined ? undefined : Math.round(filters.max * 100) });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 503 });
  const products = result.products.slice(0, 4).map((product) => {
    const inventory = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
    const business = Array.isArray(product.businesses) ? product.businesses[0] : product.businesses;
    return {
      name: product.name,
      brand: product.brand,
      supplier: business?.name ?? "Approved supplier",
      city: business?.city ?? "Location not listed",
      price: inventory ? formatMoney(inventory.unit_price_kobo, inventory.currency) : null,
      quantityAvailable: inventory?.quantity_available ?? 0,
      supplierUrl: business?.slug ? `/business/${encodeURIComponent(business.slug)}` : "/suppliers",
    };
  });
  const message = products.length
    ? `I found ${result.products.length} live listing${result.products.length === 1 ? "" : "s"} matching “${normalized || parsed.data.query}”. The first ${products.length} verified supplier offers are shown below. Prices and availability come from supplier inventory.`
    : `I checked live approved supplier inventory for “${normalized || parsed.data.query}” and found no matching available listings. You can send an SOS request so matched suppliers can quote it.`;
  const params = new URLSearchParams({ q: filters.q, city: filters.city, category: filters.category, interpreted: "1" });
  if (savedCountry) params.set("country", savedCountry);
  if (filters.min !== undefined) params.set("min", String(filters.min));
  if (filters.max !== undefined) params.set("max", String(filters.max));
  return NextResponse.json({ message, products, filters, searchUrl: `/find-stock?${params}` }, { headers: { "Cache-Control": "no-store" } });
}
