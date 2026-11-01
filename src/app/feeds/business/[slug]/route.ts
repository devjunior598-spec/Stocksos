import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMarketplaceImageUrl } from "@/lib/data";
import { PUBLIC_SITE_ORIGIN } from "@/lib/site-url";

export const dynamic = "force-dynamic";

function xml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]!);
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return new Response("Not found", { status: 404 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return new Response("Product feed is temporarily unavailable.", { status: 503 });

  const { data: business, error: businessError } = await supabase.from("businesses")
    .select("id,name,slug,verification_status,visibility")
    .eq("slug", slug).eq("verification_status", "approved").eq("visibility", "public").maybeSingle();
  if (businessError) return new Response("Product feed is temporarily unavailable.", { status: 503 });
  if (!business) return new Response("Not found", { status: 404 });

  const { data: products, error } = await supabase.from("products")
    .select("id,name,brand,condition,specifications,image_path,updated_at,inventory!inner(quantity_available,unit_price_kobo,currency)")
    .eq("business_id", business.id).eq("is_active", true).eq("visibility", "public")
    .gt("inventory.quantity_available", 0).order("updated_at", { ascending: false }).limit(1000);
  if (error) return new Response("Product feed is temporarily unavailable.", { status: 503 });

  const items = (products ?? []).map((product) => {
    const stock = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
    const productUrl = `${PUBLIC_SITE_ORIGIN}/product/${product.id}`;
    const imageUrl = getMarketplaceImageUrl(product.image_path);
    const description = product.specifications?.trim() || `${product.name} available from ${business.name}.`;
    const price = `${(Number(stock?.unit_price_kobo ?? 0) / 100).toFixed(2)} ${stock?.currency ?? "USD"}`;
    return `    <item>
      <g:id>${xml(product.id)}</g:id>
      <g:title>${xml(product.name)}</g:title>
      <g:description>${xml(description)}</g:description>
      <g:link>${xml(productUrl)}</g:link>
      ${imageUrl ? `<g:image_link>${xml(imageUrl)}</g:image_link>` : ""}
      <g:availability>in_stock</g:availability>
      <g:price>${xml(price)}</g:price>
      <g:condition>${xml(["new", "used", "refurbished"].includes(product.condition) ? product.condition : "new")}</g:condition>
      ${product.brand ? `<g:brand>${xml(product.brand)}</g:brand>` : ""}
    </item>`;
  }).join("\n");
  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xml(business.name)} · StockSOS product feed</title>
    <link>${xml(`${PUBLIC_SITE_ORIGIN}/business/${business.slug}`)}</link>
    <description>Approved supplier inventory currently available on StockSOS.</description>
${items}
  </channel>
</rss>`;

  return new Response(feed, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
