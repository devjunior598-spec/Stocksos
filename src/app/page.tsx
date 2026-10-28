import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Boxes, Building2, Clock3,
  MapPin, PackageSearch, ShieldCheck, Truck, Zap,
} from "lucide-react";

const steps = [
  { number: "01", icon: PackageSearch, title: "Tell us what’s missing", copy: "Describe the item, quantity, location and how soon you need it." },
  { number: "02", icon: Zap, title: "Reach relevant suppliers", copy: "Your request is matched against approved businesses with stock in your area." },
  { number: "03", icon: Boxes, title: "Compare real offers", copy: "Review price, quantity, preparation time and delivery options side by side." },
  { number: "04", icon: Truck, title: "Choose how to fulfil", copy: "Accept an offer, pay securely when enabled, then follow the order status." },
];

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="page-container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow"><span className="status-dot" />Business stock, within reach</span>
            <h1>Keep your business moving when <span className="highlight">stock runs out.</span></h1>
            <p className="lead">Find the stock you need. Sell the stock you have. Rescue your business in minutes with one network for urgent sourcing and local supply.</p>
            <div className="hero-buttons">
              <Link className="button button-primary" href="/sos">Send an SOS <ArrowUpRight size={16} /></Link>
              <Link className="button button-secondary" href="/become-supplier">Become a supplier <ArrowRight size={16} /></Link>
            </div>
            <div className="hero-trust">
              <span className="trust-item"><ShieldCheck size={15} /> Supplier approval process</span>
              <span className="trust-item"><MapPin size={15} /> Starting in Ibadan</span>
              <span className="trust-item"><Clock3 size={15} /> Urgency is your preference</span>
            </div>
          </div>
          <div className="hero-visual" aria-label="Illustration of the StockSOS sourcing flow">
            <div className="hero-glow" />
            <div className="float-note float-note-top"><BadgeCheck size={17} /> Verified businesses</div>
            <div className="request-card">
              <div className="request-top"><span className="request-kicker">Sourcing flow</span><span className="pill">Request to offer</span></div>
              <div className="request-product">
                <div className="product-emblem"><PackageSearch size={22} /></div>
                <div><h3>Tell suppliers what you need</h3><p>Product · quantity · location · urgency</p></div>
              </div>
              <div className="match-list">
                <div className="match-row"><div className="match-business"><span className="mini-avatar"><Building2 size={16} /></span><div><strong>Relevant suppliers</strong><small>Matched by category and city</small></div></div><BadgeCheck size={16} color="#16845b" /></div>
                <div className="match-row"><div className="match-business"><span className="mini-avatar"><Boxes size={16} /></span><div><strong>Comparable quotations</strong><small>Price, stock and delivery details</small></div></div><ArrowRight size={16} color="#246bfe" /></div>
                <div className="match-row"><div className="match-business"><span className="mini-avatar"><Truck size={16} /></span><div><strong>Buyer chooses next step</strong><small>Pickup or an arranged delivery</small></div></div><ShieldCheck size={16} color="#16845b" /></div>
              </div>
              <p className="metric-note"><Clock3 size={13} /> Delivery times are supplier estimates, not guarantees.</p>
            </div>
            <div className="float-note float-note-bottom"><Zap size={16} /> Built for business continuity</div>
          </div>
        </div>
      </section>

      <section className="proof-strip">
        <div className="page-container proof-inner">
          <span><ShieldCheck size={16} /> Verified supplier onboarding</span>
          <span><MapPin size={16} /> Location-aware sourcing</span>
          <span><Boxes size={16} /> Buyer and supplier accounts</span>
          <span><BadgeCheck size={16} /> Offers before purchase</span>
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

      <section className="section surface">
        <div className="page-container">
          <div className="section-heading">
            <span className="eyebrow">One network, two ways to move</span>
            <h2>Source what you need. Recover the sale you almost lost.</h2>
            <p className="lead">A stockout should not have to become a lost customer. StockSOS gives merchants a path to find supply and share their own stock with other businesses.</p>
          </div>
          <div className="card-grid">
            <article className="feature-card"><span className="feature-icon"><PackageSearch size={20} /></span><h3>For buyers</h3><p>Post a specific request, receive supplier quotations, compare the terms, then choose whether to proceed.</p><Link className="text-link" href="/sos">Create an SOS request <ArrowRight size={15} /></Link></article>
            <article className="feature-card"><span className="feature-icon"><Building2 size={20} /></span><h3>For suppliers</h3><p>List available stock, respond to matching requests and manage quotations and orders from one workspace.</p><Link className="text-link" href="/become-supplier">Apply to supply <ArrowRight size={15} /></Link></article>
            <article className="feature-card"><span className="feature-icon"><Zap size={20} /></span><h3>For local merchants</h3><p>Share a business profile through SOS Link and ask the network to help source items you do not carry.</p><Link className="text-link" href="/how-it-works">See how it works <ArrowRight size={15} /></Link></article>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="page-container band-inner">
          <div><h2>When stock is the problem, start with a request.</h2><p>Tell the network what your business needs and compare the responses.</p></div>
          <Link className="button button-primary" href="/sos">Send an SOS <ArrowUpRight size={16} /></Link>
        </div>
      </section>
    </>
  );
}
