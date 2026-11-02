import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, BarChart3, Boxes,
  Globe2, Megaphone, PackageSearch, ShieldCheck, Truck, Zap,
} from "lucide-react";
import { dedupePublicListings, formatMoney, getMarketplaceImageUrl, getProductsResult } from "@/lib/data";

export const dynamic = "force-dynamic";

const steps = [
  { number: "01", icon: PackageSearch, title: "Tell us what’s missing", copy: "Describe the item, quantity, location and how soon you need it." },
  { number: "02", icon: Zap, title: "Reach relevant suppliers", copy: "Your request is matched against approved businesses with stock in your area." },
  { number: "03", icon: Boxes, title: "Compare real offers", copy: "Review price, quantity, preparation time and delivery options side by side." },
  { number: "04", icon: Truck, title: "Choose how to fulfil", copy: "Accept an offer, pay securely when enabled, then follow the order status." },
];

const promotionChannels = [
  { name: "Instagram", icon: "instagram", className: "instagram" },
  { name: "TikTok", icon: "tiktok", className: "tiktok" },
  { name: "Facebook", icon: "facebook-f", className: "facebook" },
  { name: "YouTube", icon: "youtube", className: "youtube" },
  { name: "Google", icon: "google", className: "google" },
  { name: "LinkedIn", icon: "linkedin-in", className: "linkedin" },
  { name: "X", icon: "x-twitter", className: "x" },
  { name: "Pinterest", icon: "pinterest-p", className: "pinterest" },
  { name: "WhatsApp", icon: "whatsapp", className: "whatsapp" },
];

function PromotionChannelGroup({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <div className="promotion-channel-group" role={duplicate ? undefined : "list"} aria-hidden={duplicate || undefined}>
      {promotionChannels.map((channel) => (
        <div className="promotion-channel" role={duplicate ? undefined : "listitem"} key={channel.name}>
          <span className={`promotion-channel-mark channel-${channel.className}`} aria-hidden="true"><Image src={`/brand-icons/${channel.icon}.svg`} width={22} height={22} alt="" /></span>
          <span><strong>{channel.name}</strong><small>Connect when eligible</small></span>
        </div>
      ))}
    </div>
  );
}

export default async function HomePage() {
  const { products: latestProducts, error: productFeedError } = await getProductsResult(undefined, undefined, 8);
  const publicListings = dedupePublicListings(latestProducts);

  return (
    <div className="home-page">
      <section className="hero">
        <div className="page-container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow"><span className="status-dot" />The business inventory network</span>
            <h1>Find the stock.<br /><span className="highlight">Keep business moving.</span></h1>
            <p className="lead">Search real supplier inventory, request what you can’t find, and turn your own products into listings buyers can discover.</p>
            <form className="hero-stock-search" action="/find-stock">
              <label htmlFor="hero-query">Start with a product</label>
              <div><PackageSearch size={22} aria-hidden="true" /><input id="hero-query" name="q" placeholder="Search products, brands, materials…" maxLength={80} /><button type="submit" className="button button-primary">Find stock <ArrowRight size={17} /></button></div>
            </form>
            <div className="hero-buttons">
              <Link className="button button-primary" href="/sos">Request stock <ArrowUpRight size={16} /></Link>
              <Link className="button button-secondary" href="/become-supplier"><Megaphone size={16} /> Start selling</Link>
            </div>
            <div className="hero-trust">
              <span className="trust-item"><PackageSearch size={15} /> Real inventory</span>
              <span className="trust-item"><ShieldCheck size={15} /> Approved suppliers</span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-pathways">
              <span className="eyebrow">Choose your next move</span>
              <h2>One place for both sides of trade.</h2>
              <Link className="hero-pathway" href="/find-stock">
                <span className="hero-pathway-icon"><PackageSearch size={18} /></span>
                <span><strong>Search the marketplace</strong><small>Explore public listings with current stock.</small></span>
                <ArrowRight size={16} />
              </Link>
              <Link className="hero-pathway" href="/sos">
                <span className="hero-pathway-icon"><Truck size={18} /></span>
                <span><strong>Send a sourcing request</strong><small>Describe your need and compare supplier quotes.</small></span>
                <ArrowRight size={16} />
              </Link>
              <Link className="hero-pathway" href="/become-supplier">
                <span className="hero-pathway-icon"><Megaphone size={18} /></span>
                <span><strong>Build a supplier storefront</strong><small>Publish products and respond to buyers.</small></span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="proof-strip">
        <div className="page-container proof-inner">
          <span><Megaphone size={16} /> Product promotion tools</span>
          <span><Globe2 size={16} /> Public supplier storefronts</span>
          <span><PackageSearch size={16} /> Buyer product discovery</span>
          <span><BadgeCheck size={16} /> Approved supplier accounts</span>
        </div>
      </section>

      <section className="section home-product-showcase" aria-labelledby="latest-products-title">
        <div className="page-container">
          <div className="home-product-heading">
            <div className="section-heading">
              <span className="eyebrow"><PackageSearch size={14} /> Live supplier inventory</span>
              <h2 id="latest-products-title">Discover products available now.</h2>
              <p className="lead">New public listings appear here automatically after the supplier is approved and the product has available stock.</p>
            </div>
            <Link className="button button-secondary" href="/find-stock">Browse all products <ArrowRight size={16} /></Link>
          </div>
          {productFeedError ? <div className="notice notice-error" role="alert"><PackageSearch size={18} /><div><strong>Live products are temporarily unavailable.</strong><p>{productFeedError}</p></div></div> : publicListings.length ? <div className="catalog-grid home-product-grid">{publicListings.map((product) => {
            const stock = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
            const business = Array.isArray(product.businesses) ? product.businesses[0] : product.businesses;
            const imageUrl = getMarketplaceImageUrl(product.image_path);
            return <article className="product-card home-product-card" key={product.id}>
              <Link className={`product-placeholder${imageUrl ? "" : " product-photo-missing"}`} href={`/product/${product.id}`} aria-label={`View ${product.name}`}>
                {imageUrl ? <Image src={imageUrl} alt={product.name} fill unoptimized sizes="(max-width: 700px) 50vw, (max-width: 1050px) 33vw, 25vw" className="product-image" /> : <><PackageSearch size={28} /><span>Supplier photo unavailable</span></>}
              </Link>
              <div className="product-detail">
                <div className="product-card-badges"><span className="pill pill-green"><BadgeCheck size={11} /> Approved</span><span className="pill">{product.condition}</span></div>
                <h3><Link href={`/product/${product.id}`}>{product.name}</Link></h3>
                <p>{business?.name ?? "Approved supplier"}</p>
                <p>{[product.brand, business?.city, business?.country].filter(Boolean).join(" · ") || "Supplier location not listed"}</p>
                <div className="product-price">{stock ? formatMoney(stock.unit_price_kobo, stock.currency) : "Price on request"}<small> per unit</small></div>
                <div className="home-product-meta"><span>{stock ? `${stock.quantity_available} available` : "Check availability"}</span><Link className="text-link" href={`/product/${product.id}`}>View <ArrowRight size={13} /></Link></div>
              </div>
            </article>;
          })}</div> : <div className="empty-state home-product-empty"><div className="empty-state-icon"><PackageSearch size={22} /></div><h3>Supplier products will appear here</h3><p>StockSOS displays available inventory from approved suppliers. Suppliers can publish their listings to make them discoverable.</p><div className="hero-buttons"><Link className="button button-primary" href="/become-supplier">List products as a supplier <ArrowRight size={15} /></Link><Link className="button button-secondary" href="/sos">Request a product</Link></div></div>}
        </div>
      </section>

      <section className="promotion-channel-strip" aria-labelledby="promotion-channels-title">
        <div className="page-container promotion-channel-heading">
          <div>
            <span className="eyebrow"><Megaphone size={14} /> Built for multi-channel promotion</span>
            <h2 id="promotion-channels-title">Show your products where customers spend time.</h2>
          </div>
          <p>Prepare product content for leading social, search and messaging channels. Each channel becomes available after setup, supplier approval and eligibility review.</p>
        </div>
        <div className="promotion-channel-marquee" aria-label="Planned promotion channels">
          <div className="promotion-channel-track">
            <PromotionChannelGroup />
            <PromotionChannelGroup duplicate />
          </div>
        </div>
      </section>

      <section className="section reach-home-section">
        <div className="page-container reach-home-grid">
          <div>
            <span className="eyebrow"><Globe2 size={14} /> StockSOS Reach for suppliers</span>
            <h2>Promote and advertise your products to more customers.</h2>
            <p className="lead">Create a public storefront, publish accurate product listings and prepare promotional content from one supplier workspace. Buyers can discover your available inventory on StockSOS.</p>
            <div className="hero-buttons"><Link className="button button-primary" href="/become-supplier">Promote my products <ArrowUpRight size={16} /></Link><Link className="button button-secondary" href="/how-it-works#reach">See how promotion works <ArrowRight size={16} /></Link></div>
            <p className="form-hint">You approve promotional content before external publishing. Channel eligibility applies, and StockSOS does not promise specific sales, traffic or advertising results.</p>
          </div>
          <div className="reach-home-preview" aria-label="StockSOS Reach supplier tools">
            <div className="reach-preview-head"><span className="eyebrow"><Globe2 size={13} /> StockSOS Reach</span><strong>One place to grow product visibility</strong></div>
            <div className="reach-preview-row"><span className="feature-icon"><PackageSearch size={18} /></span><div><strong>Public product listings</strong><small>Share current price, stock and supplier details with buyers.</small></div></div>
            <div className="reach-preview-row"><span className="feature-icon"><Megaphone size={18} /></span><div><strong>Promotion tools</strong><small>Prepare and review product content before you share it.</small></div></div>
            <div className="reach-preview-row"><span className="feature-icon"><BarChart3 size={18} /></span><div><strong>External channel setup</strong><small>Connect eligible accounts before publishing beyond StockSOS.</small></div></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="page-container">
          <div className="section-heading">
            <span className="eyebrow">A practical way to source</span>
            <h2>From “we’re out” to a clear next step.</h2>
            <p className="lead">StockSOS connects businesses that need inventory with verified businesses that can supply it.</p>
          </div>
          <div className="workflow-grid">
            {steps.map((step) => {
              const Icon = step.icon;
              return <article className="workflow-card" key={step.number}>
                <div className="workflow-number">{step.number}</div>
                <span className="feature-icon"><Icon size={20} /></span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>;
            })}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="page-container band-inner">
          <div><h2>When stock is the problem, start with a request.</h2><p>Tell the network what your business needs and compare the responses.</p></div>
          <Link className="button button-primary" href="/sos">Send an SOS <ArrowUpRight size={16} /></Link>
        </div>
      </section>
    </div>
  );
}
