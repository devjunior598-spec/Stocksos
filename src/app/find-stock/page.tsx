import Link from "next/link";
import Image from "next/image";
import { ArrowRight, PackageSearch } from "lucide-react";
import { getCategories, getProducts, formatNaira, getMarketplaceImageUrl } from "@/lib/data";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { z } from "zod";

type Props = { searchParams: Promise<{ q?: string; category?: string; city?: string; min?: string; max?: string }> };

export default async function FindStockPage({ searchParams }: Props) {
  const params = await searchParams;
  const search = params.q?.trim().slice(0, 80) ?? "";
  const categoryId = z.uuid().safeParse(params.category).success ? params.category : undefined;
  const city = params.city?.trim().slice(0, 60) ?? "";
  const parsePrice = (value?: string) => {
    if (!value || !/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) return undefined;
    const amount = Math.round(Number(value) * 100);
    return Number.isSafeInteger(amount) ? amount : undefined;
  };
  const min = parsePrice(params.min);
  const max = parsePrice(params.max);
  const [products, categories] = await Promise.all([
    getProducts(search, { categoryId, city, minPriceKobo: min, maxPriceKobo: max }),
    getCategories(),
  ]);
  return (
    <>
      <section className="page-hero"><div className="page-container"><span className="eyebrow">Stock discovery</span><h1>Find stock for your business.</h1><p className="lead">Search public listings from approved suppliers. If you can’t find what you need, send an SOS request.</p>
        <form className="search-form" action="/find-stock"><input className="search-input" name="q" type="search" defaultValue={search} placeholder="Product name or brand" aria-label="Search products" /><button className="button button-primary" type="submit">Search stock <ArrowRight size={15} /></button></form>
      </div></section>
      <section className="section-tight"><div className="page-container">
        <SupabaseSetupNotice />
        <form className="filter-row" action="/find-stock">
          <input type="hidden" name="q" value={search} />
          <div className="form-field"><label htmlFor="category">Category</label><select id="category" name="category" defaultValue={categoryId ?? ""}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
          <div className="form-field"><label htmlFor="city">City</label><input id="city" name="city" defaultValue={city} placeholder="Ibadan" /></div>
          <div className="form-field"><label htmlFor="min">Minimum ₦</label><input id="min" name="min" type="number" min="0" step="0.01" defaultValue={params.min ?? ""} /></div>
          <div className="form-field"><label htmlFor="max">Maximum ₦</label><input id="max" name="max" type="number" min="0" step="0.01" defaultValue={params.max ?? ""} /></div>
          <button className="button button-secondary" type="submit">Apply filters</button>
        </form>
        {products.length ? <div className="catalog-grid">{products.map((product) => {
          const stock = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
          const business = Array.isArray(product.businesses) ? product.businesses[0] : product.businesses;
          const imageUrl = getMarketplaceImageUrl(product.image_path);
          return <article className="product-card" key={product.id}>
            <div className="product-placeholder">{imageUrl ? <Image src={imageUrl} alt={product.name} fill unoptimized sizes="(max-width: 700px) 100vw, (max-width: 1050px) 50vw, 33vw" className="product-image" /> : <PackageSearch size={34} />}</div>
            <div className="product-detail">
              <span className="pill">{product.condition}</span>
              <h3>{product.name}</h3>
              <p>{[product.brand, business?.city].filter(Boolean).join(" · ") || "Approved supplier listing"}</p>
              <div className="product-price">{stock ? formatNaira(stock.unit_price_kobo) : "Price on request"}</div>
              <p>{stock ? stock.quantity_available + " available" : "Check with supplier"}</p>
              <Link className="text-link" href={business?.slug ? "/business/" + business.slug : "/sos"}>View supplier <ArrowRight size={14} /></Link>
            </div>
          </article>;
        })}</div> : <div className="empty-state"><div className="empty-state-icon"><PackageSearch size={22} /></div><h3>{search ? "No matching listings yet" : "Listings will appear here"}</h3><p>StockSOS doesn’t publish sample inventory. If your item is not listed, request it and matched suppliers can respond with an offer.</p><Link className="button button-primary" href="/sos">Request this stock <ArrowRight size={15} /></Link></div>}
      </div></section>
    </>
  );
}
