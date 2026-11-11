import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, BarChart3, Boxes,
  Globe2, Megaphone, PackageSearch, ShieldCheck, Sparkles, Truck, Zap,
} from "lucide-react";
import { dedupePublicListings, formatMoney, getMarketplaceImageUrl, getProductsResult, type PublicProduct } from "@/lib/data";

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

function ProductShowcaseCard({ product, featured = false }: { product: PublicProduct; featured?: boolean }) {
  const stock = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
  const business = Array.isArray(product.businesses) ? product.businesses[0] : product.businesses;
  const imageUrl = getMarketplaceImageUrl(product.image_path);
  return <article className={`product-card home-product-card${featured ? " home-product-featured" : ""}`}>
    <Link className={`product-placeholder${imageUrl ? "" : " product-photo-missing"}`} href={`/product/${product.id}`} aria-label={`View ${product.name}`}>
      {imageUrl ? <Image src={imageUrl} alt={product.name} fill unoptimized sizes={featured ? "(max-width: 700px) 100vw, 560px" : "(max-width: 700px) 100vw, (max-width: 1050px) 50vw, 33vw"} className="product-image" /> : <><PackageSearch size={32} /><span>Supplier photo unavailable</span></>}
    </Link>
    <div className="product-detail">
      <div className="product-card-badges"><span className="pill pill-green"><BadgeCheck size={11} /> Approved supplier</span><span className="pill">{product.condition}</span></div>
      <h3><Link href={`/product/${product.id}`}>{product.name}</Link></h3>
      <p className="home-product-supplier">{business?.name ?? "Approved supplier"}</p>
      <p>{[product.brand, business?.city, business?.country].filter(Boolean).join(" · ") || "Supplier location not listed"}</p>
      <div className="product-price">{stock ? formatMoney(stock.unit_price_kobo, stock.currency) : "Price on request"}<small> per unit</small></div>
      <div className="home-product-meta"><span>{stock ? `${stock.quantity_available} available` : "Check availability"}</span><Link className="text-link" href={`/product/${product.id}`}>View listing <ArrowRight size={13} /></Link></div>
    </div>
  </article>;
}

export default async function HomePage() {
  const { products: latestProducts, error: productFeedError } = await getProductsResult(undefined, undefined, 12);
  const publicListings = dedupePublicListings(latestProducts).slice(0, 7);

  return (
    <div className="home-page">
      <section className="hero">
        <div className="page-container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow"><span className="status-dot" /> The inventory network for business</span>
            <h1>Make stock<br /><span className="highlight">move smarter.</span></h1>
            <p className="lead">Find the products your business needs. Put your own inventory in front of buyers. Move from a stock problem to a clear next step in one place.</p>
            <form className="hero-stock-search" action="/find-stock">
              <label htmlFor="hero-query">Start with a product</label>
              <div><PackageSearch size={21} aria-hidden="true" /><input id="hero-query" name="q" placeholder="Search products or brands" maxLength={80} /><button type="submit" className="button button-primary">Search stock <ArrowRight size={17} /></button></div>
            </form>
            <div className="hero-buttons">
              <Link className="button button-secondary" href="/sos">Request hard-to-find stock <ArrowUpRight size={16} /></Link>
              <Link className="hero-inline-link" href="/become-supplier">I want to sell <ArrowRight size={16} /></Link>
            </div>
            <p className="hero-microcopy"><ShieldCheck size={15} /> Supplier listings are reviewed before they appear publicly.</p>
          </div>
          <div className="hero-visual">
            <div className="network-panel">
              <div className="network-panel-top"><span>STOCKSOS / HOW IT MOVES</span><span className="network-panel-dots" aria-hidden="true"><i /><i /><i /></span></div>
              <h2>From need to next move.</h2>
              <p>One connected path for sourcing and selling.</p>
              <div className="network-steps">
                <Link href="/find-stock" className="network-step"><span className="network-step-number">01</span><span className="network-step-icon"><PackageSearch size={20} /></span><span><strong>Discover stock</strong><small>Search real public inventory</small></span><ArrowUpRight size={17} /></Link>
                <Link href="/sos" className="network-step"><span className="network-step-number">02</span><span className="network-step-icon"><Zap size={20} /></span><span><strong>Request and compare</strong><small>Get supplier quotations when needed</small></span><ArrowUpRight size={17} /></Link>
                <Link href="/become-supplier" className="network-step"><span className="network-step-number">03</span><span className="network-step-icon"><Megaphone size={20} /></span><span><strong>Put products to work</strong><small>Publish and share your listings</small></span><ArrowUpRight size={17} /></Link>
              </div>
              <div className="network-panel-bottom"><span><span className="status-dot" /> BUILT FOR BUSINESS BUYERS</span><span>AND SUPPLIERS <ArrowRight size={13} /></span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section home-product-showcase" aria-labelledby="latest-products-title">
        <div className="page-container">
          <div className="home-market-intro">
            <div className="section-heading">
              <span className="eyebrow"><span className="status-dot" /> Live marketplace</span>
              <h2 id="latest-products-title">Good stock should be easy to find.</h2>
              <p className="lead">Explore products listed by approved suppliers. See the price, location and available quantity before you make contact.</p>
            </div>
            <div className="home-market-actions"><Link className="button button-primary" href="/find-stock">Explore all stock <ArrowRight size={16} /></Link><Link className="text-link" href="/sos">Need something else? Send an SOS <ArrowUpRight size={14} /></Link></div>
          </div>
          {productFeedError ? <div className="notice notice-error" role="alert"><PackageSearch size={18} /><div><strong>Live products are temporarily unavailable.</strong><p>{productFeedError}</p></div></div> : publicListings.length ? <div className="home-market-content"><ProductShowcaseCard product={publicListings[0]} featured /><div className="catalog-grid home-product-grid">{publicListings.slice(1).map((product) => <ProductShowcaseCard product={product} key={product.id} />)}</div></div> : <div className="home-market-empty"><div><span className="eyebrow"><Sparkles size={14} /> New marketplace</span><h3>The first listings are on their way.</h3><p>Approved suppliers will appear here as they publish products. In the meantime, describe what you need and let suppliers respond with an offer.</p><div className="hero-buttons"><Link className="button button-primary" href="/sos">Request stock <ArrowRight size={15} /></Link><Link className="button button-secondary" href="/become-supplier">List your products</Link></div></div><div className="home-market-empty-art" aria-hidden="true"><PackageSearch size={44} /><span>YOUR NEXT SOURCE STARTS HERE</span></div></div>}
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
            <p className="lead">Create a public storefront, publish accurate product listings and prepare promotional campaigns from one supplier workspace. StockSOS helps your inventory appear where buyers are already searching and requesting stock.</p>
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
