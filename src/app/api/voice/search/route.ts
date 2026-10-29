import { NextResponse } from "next/server";
import { z } from "zod";
import { formatNaira, getProductsResult } from "@/lib/data";

const requestSchema = z.object({ query: z.string().trim().min(2).max(180) });

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Send a product or stock request to search." }, { status: 400 }); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter at least two characters to search stock." }, { status: 400 });

  const normalized = parsed.data.query
    .replace(/^(please\s+)?(i('| a)m\s+)?(looking for|searching for|find me|find|show me|do you have|i need|we need)\s+/i, "")
    .replace(/[?.!,]+$/g, "")
    .trim();
  const result = await getProductsResult(normalized || parsed.data.query);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 503 });
  const products = result.products.slice(0, 4).map((product) => {
    const inventory = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
    const business = Array.isArray(product.businesses) ? product.businesses[0] : product.businesses;
    return {
      name: product.name,
      brand: product.brand,
      supplier: business?.name ?? "Approved supplier",
      city: business?.city ?? "Location not listed",
      price: inventory ? formatNaira(inventory.unit_price_kobo) : null,
      quantityAvailable: inventory?.quantity_available ?? 0,
      supplierUrl: business?.slug ? `/business/${encodeURIComponent(business.slug)}` : "/suppliers",
    };
  });
  const message = products.length
    ? `I found ${result.products.length} live listing${result.products.length === 1 ? "" : "s"} matching “${normalized || parsed.data.query}”. The first ${products.length} verified supplier offers are shown below. Prices and availability come from supplier inventory.`
    : `I checked live approved supplier inventory for “${normalized || parsed.data.query}” and found no matching available listings. You can send an SOS request so matched suppliers can quote it.`;
  return NextResponse.json({ message, products }, { headers: { "Cache-Control": "no-store" } });
}
