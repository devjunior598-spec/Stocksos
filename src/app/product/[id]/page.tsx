import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, MapPin, ShieldCheck, Zap } from "lucide-react";
import { notFound } from "next/navigation";
import { formatMoney, getMarketplaceImageUrl } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { ProductMediaGallery } from "@/components/product-media-gallery";

type Props = { params: Promise<{ id: string }> };

async function getPublicProduct(id: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.from("products")
    .select("id,name,brand,condition,specifications,image_path,media_paths,category_id,created_at,updated_at,inventory!inner(quantity_available,unit_price_kobo,currency),businesses!inner(id,name,slug,country,region,city,area,description,verification_status,visibility)")
    .eq("id", id).eq("is_active", true).eq("visibility", "public")
    .eq("businesses.verification_status", "approved").eq("businesses.visibility", "public")
    .gt("inventory.quantity_available", 0).maybeSingle();
  return data as unknown as { id: string; name: string; brand: string | null; condition: string; specifications: string | null; image_path: string | null; category_id: string; created_at: string; updated_at: string; inventory: { quantity_available: number; unit_price_kobo: number; currency: string } | { quantity_available: number; unit_price_kobo: number; currency: string }[]; businesses: { id: string; name: string; slug: string; country: string; region: string | null; city: string; area: string | null; description: string | null; verification_status: string; visibility: string } | { id: string; name: string; slug: string; country: string; region: string | null; city: string; area: string | null; description: string | null; verification_status: string; visibility: string }[] } | null;
}

function unwrap<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await getPublicProduct(id);
  if (!product) return {};
  const business = unwrap(product.businesses);
  const stock = unwrap(product.inventory);
  const description = product.specifications || `${product.name} available from ${business.name} in ${business.city}.`;
  return {
    title: `${product.name} from ${business.name}`,
    description,
    alternates: { canonical: `/product/${product.id}` },
    openGraph: { title: `${product.name} · ${business.name}`, description, type: "website", images: getMarketplaceImageUrl(product.image_path) ? [{ url: getMarketplaceImageUrl(product.image_path)! }] : undefined },
    other: { "product:price:amount": String(Number(stock.unit_price_kobo) / 100), "product:price:currency": stock.currency },
  };
}

export default async function PublicProductPage({ params }: Props) {
  const { id } = await params;
  const product = await getPublicProduct(id);
  if (!product) {
    const supabase = await createSupabaseServerClient();
    return supabase ? notFound() : <section className="page-container section-tight"><SupabaseSetupNotice /></section>;
  }
  const business = unwrap(product.businesses);
  const stock = unwrap(product.inventory);
  const imageUrl = getMarketplaceImageUrl(product.image_path);
  const storedMediaPaths = (product as typeof product & { media_paths?: string[] }).media_paths ?? [];
  const mediaPaths = Array.from(new Set([...storedMediaPaths, product.image_path].filter((path): path is string => Boolean(path))));
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.specifications || undefined,
    image: imageUrl ? [imageUrl] : undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    seller: { "@type": "Organization", name: business.name, url: `/business/${business.slug}` },
    offers: { "@type": "Offer", priceCurrency: stock.currency, price: Number(stock.unit_price_kobo) / 100, availability: "https://schema.org/InStock", url: `/product/${product.id}` },
  };
  const safeJsonLd = JSON.stringify(productJsonLd).replace(/</g, "\\u003c");
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd }} />
    <section className="page-hero"><div className="page-container"><span className="eyebrow"><BadgeCheck size={14} /> Verified supplier listing</span><p className="small muted"><Link href={`/business/${business.slug}`}>{business.name}</Link> · {[business.area, business.city, business.region, business.country].filter(Boolean).join(", ")}</p><h1>{product.name}</h1><p className="lead">Available from an approved StockSOS supplier.</p></div></section>
    <section className="section-tight"><div className="page-container product-public-grid">
      <article className="panel product-public-card"><ProductMediaGallery paths={mediaPaths} title={product.name} /><div className="product-public-copy"><div className="product-public-tags"><span className="pill pill-green"><ShieldCheck size={12} /> Public stock</span><span className="pill">{product.condition}</span></div><h2>{product.name}</h2>{product.brand ? <p className="muted">Brand: {product.brand}</p> : null}{product.specifications ? <p className="product-description">{product.specifications}</p> : null}<div className="product-public-price">{formatMoney(stock.unit_price_kobo, stock.currency)} <span>per unit</span></div><p className="stock-available">{stock.quantity_available} available · {business.city}, {business.country}</p></div></article>
      <aside className="product-public-aside"><section className="panel"><span className="eyebrow"><Building2 size={14} /> Supplier</span><h3>{business.name}</h3><p className="saved-location"><MapPin size={14} /> {[business.area, business.city, business.region, business.country].filter(Boolean).join(", ")}</p>{business.description ? <p className="muted small">{business.description}</p> : null}<Link className="text-link" href={`/business/${business.slug}`}>View supplier storefront <ArrowRight size={14} /></Link></section><section className="panel"><span className="eyebrow">Source this stock</span><h3>Need this product?</h3><p className="muted small">Send an SOS request and let approved suppliers respond with availability and quotations.</p><Link className="button button-primary form-submit" href="/sos"><Zap size={15} /> Send an SOS request</Link><Link className="button button-secondary form-submit" href={`/business/${business.slug}`}>Ask this supplier <ArrowRight size={15} /></Link></section></aside>
    </div></section>
  </>;
}
