import { getProductsResult, formatMoney } from "@/lib/data";
import { PUBLIC_SITE_ORIGIN } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const xml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
})[character] ?? character);

export async function GET() {
  const { products, error } = await getProductsResult(undefined, undefined, 40);
  if (error) return new Response("Product feed is temporarily unavailable.", { status: 503, headers: { "Cache-Control": "no-store" } });

  const items = products.map((product) => {
    const inventory = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
    const business = Array.isArray(product.businesses) ? product.businesses[0] : product.businesses;
    const url = `${PUBLIC_SITE_ORIGIN}/product/${encodeURIComponent(product.id)}`;
    const details = [
      business?.name ? `Supplier: ${business.name}` : "Approved supplier",
      business?.city && business?.country ? `Location: ${business.city}, ${business.country}` : null,
      inventory ? `Price: ${formatMoney(inventory.unit_price_kobo, inventory.currency)}` : null,
      inventory ? `Available: ${inventory.quantity_available}` : null,
    ].filter(Boolean).join(" · ");
    return `<item><title>${xml(product.name)}</title><link>${xml(url)}</link><guid isPermaLink="true">${xml(url)}</guid><description>${xml(details)}</description><pubDate>${new Date(product.created_at).toUTCString()}</pubDate></item>`;
  }).join("");

  const feed = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>StockSOS available products</title><link>${xml(PUBLIC_SITE_ORIGIN)}</link><description>Available public inventory from approved StockSOS suppliers.</description><language>en</language>${items}</channel></rss>`;
  return new Response(feed, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=300" } });
}
