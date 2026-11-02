import Link from "next/link";
import Image from "next/image";
import { ArrowRight, PackageSearch } from "lucide-react";
import { getCategories, getProductsResult, formatMoney, getMarketplaceImageUrl } from "@/lib/data";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { z } from "zod";
import { VoiceTextField } from "@/components/voice-text-field";
import { createSavedSearchAction } from "@/app/actions";
import { getAuthenticatedUser, getMarketplaceRole } from "@/lib/auth";

type Props = { searchParams: Promise<{ q?: string; category?: string; country?: string; city?: string; min?: string; max?: string; interpreted?: string }> };

export default async function FindStockPage({ searchParams }: Props) {
  const params = await searchParams;
  const search = params.q?.trim().slice(0, 80) ?? "";
  const categoryId = z.uuid().safeParse(params.category).success ? params.category : undefined;
  const city = params.city?.trim().slice(0, 60) ?? "";
  const country = /^[A-Za-z]{2}$/.test(params.country ?? "") ? params.country!.toUpperCase() : "";
  const parsePrice = (value?: string) => {
    if (!value || !/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) return undefined;
    const amount = Math.round(Number(value) * 100);
    return Number.isSafeInteger(amount) ? amount : undefined;
  };
  const min = parsePrice(params.min);
  const max = parsePrice(params.max);
  const [productResult, categories, user] = await Promise.all([
    getProductsResult(search, { categoryId, country, city, minPriceKobo: min, maxPriceKobo: max }),
    getCategories(),
    getAuthenticatedUser(),
  ]);
  const role = user ? await getMarketplaceRole(user.id) : null;
  const hasFilters = Boolean(search || categoryId || city || country || min !== undefined || max !== undefined);
  const canSaveSearch = role === "buyer" && hasFilters;
  const { products, error: productError } = productResult;
  return (
    <>
      <section className="page-hero"><div className="page-container"><span className="eyebrow">Stock discovery</span><h1>Find stock for your business.</h1><p className="lead">Search public listings from approved suppliers. If you can’t find what you need, send an SOS request.</p>
        <form className="search-form" action="/find-stock"><VoiceTextField id="stock-search" name="q" defaultValue={search} placeholder="Product name, brand or spoken description" maxLength={80} fallbackAvailable={Boolean(process.env.OPENAI_API_KEY)} /><button className="button button-primary" type="submit">Search stock <ArrowRight size={15} /></button></form><p className="form-hint">Search product names, brands and specifications in available supplier inventory.</p>
      </div></section>
      <section className="section-tight"><div className="page-container">
        <SupabaseSetupNotice />
        {params.interpreted === "1" ? <div className="notice" role="status"><div><strong>Your search details are ready.</strong><p>Review or change the filters below. {city ? `Searching in ${city}.` : "No city was provided or saved; results include all cities."} {categoryId ? "A matching category was selected." : "Category was uncertain, so all categories are included."} Price filters are in USD.</p></div></div> : null}
        {productError ? <div className="notice notice-error" role="alert"><PackageSearch size={18} /><div><strong>Stock search could not be completed.</strong><p>{productError}</p></div></div> : null}
        <details className="search-filter-panel" open={Boolean(categoryId || city || country || min !== undefined || max !== undefined)}><summary>Refine results <span>{[categoryId, city, country, min, max].filter((value) => value !== undefined && value !== "").length ? "Filters active" : "Category, location and price"}</span></summary><form className="filter-row" action="/find-stock">
          <input type="hidden" name="q" value={search} />
          <div className="form-field"><label htmlFor="category">Category</label><select id="category" name="category" defaultValue={categoryId ?? ""}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
          <div className="form-field"><label htmlFor="country">Country code</label><input id="country" name="country" defaultValue={country} placeholder="US" minLength={2} maxLength={2} autoCapitalize="characters" /></div>
          <div className="form-field"><label htmlFor="city">City</label><input id="city" name="city" defaultValue={city} placeholder="Enter a city" /></div>
          <div className="form-field"><label htmlFor="min">Minimum USD</label><input id="min" name="min" type="number" min="0" step="0.01" defaultValue={params.min ?? ""} /></div>
          <div className="form-field"><label htmlFor="max">Maximum USD</label><input id="max" name="max" type="number" min="0" step="0.01" defaultValue={params.max ?? ""} /></div>
          <button className="button button-secondary" type="submit">Apply filters</button>
        </form></details>
        {canSaveSearch ? <form action={createSavedSearchAction} className="save-search-inline"><div><strong>Want to check back later?</strong><span>Get a notification when matching approved stock appears.</span></div><input type="hidden" name="query" value={search || categories.find((category) => category.id === categoryId)?.name || "available stock"} /><input type="hidden" name="category_id" value={categoryId ?? ""} /><input type="hidden" name="country" value={country} /><input type="hidden" name="city" value={city} /><input type="hidden" name="min_price" value={params.min ?? ""} /><input type="hidden" name="max_price" value={params.max ?? ""} /><input name="name" aria-label="Alert name" required minLength={2} maxLength={80} defaultValue={search ? `${search} stock alert` : "My stock alert"} /><button className="button button-secondary button-small" type="submit">Save alert</button></form> : null}
        {!user && search ? <div className="save-search-inline"><div><strong>Save this search</strong><span>Sign in as a buyer to get alerts when matching stock appears.</span></div><Link className="button button-secondary button-small" href={`/login?next=${encodeURIComponent("/find-stock?" + new URLSearchParams({ q: search }))}`}>Sign in to save</Link></div> : null}
        {!productError ? <div className="catalog-results-heading" role="status"><div><span className="eyebrow">Supplier inventory</span><h2>{hasFilters ? `Results for your search` : "Available products"}</h2></div><span>{products.length} {products.length === 1 ? "listing" : "listings"}</span></div> : null}
        {products.length ? <div className="catalog-grid">{products.map((product) => {
          const stock = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
          const business = Array.isArray(product.businesses) ? product.businesses[0] : product.businesses;
          const imageUrl = getMarketplaceImageUrl(product.image_path);
          return <article className="product-card" key={product.id}>
            <div className={`product-placeholder${imageUrl ? "" : " product-photo-missing"}`}>{imageUrl ? <Image src={imageUrl} alt={product.name} fill unoptimized sizes="(max-width: 700px) 100vw, (max-width: 1050px) 50vw, 33vw" className="product-image" /> : <><PackageSearch size={28} /><span>Supplier photo unavailable</span></>}</div>
            <div className="product-detail">
              <div className="product-match-labels"><span className="pill">{product.condition}</span>{product.searchMatch ? <span className="pill pill-green">{product.searchMatch}</span> : null}</div>
              <h3>{product.name}</h3>
              <p className="product-supplier-name">{business?.name ?? "Approved supplier"}</p>
              <p>{[product.brand, business?.city, business?.country].filter(Boolean).join(" · ") || "Supplier location not listed"}</p>
              <div className="product-price">{stock ? formatMoney(stock.unit_price_kobo, stock.currency) : "Price on request"}<small> per unit</small></div>
              <p>{stock ? `${stock.quantity_available} available` : "Check with supplier"}</p>
              <Link className="text-link" href={`/product/${product.id}`}>View product <ArrowRight size={14} /></Link>
            </div>
          </article>;
        })}</div> : !productError ? <div className="empty-state"><div className="empty-state-icon"><PackageSearch size={22} /></div><h3>{search ? "No matching listings yet" : "Listings will appear here"}</h3><p>Can’t find what you need? Send a request and matching suppliers can respond with an offer.</p><Link className="button button-primary" href="/sos">Request this stock <ArrowRight size={15} /></Link></div> : null}
      </div></section>
    </>
  );
}
