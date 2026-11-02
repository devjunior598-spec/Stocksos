import Link from "next/link";
import { ArrowRight, ArrowUpRight, BadgeCheck, BarChart3, Boxes, Building2, CheckCircle2, Globe2, Megaphone, PackageSearch, ShieldCheck, Truck, Zap } from "lucide-react";

const buyerSteps = [
  { icon: PackageSearch, title: "Search available stock", copy: "Browse public product listings from approved suppliers. Filter by location, category and price." },
  { icon: Zap, title: "Describe what’s missing", copy: "If you need something else, tell StockSOS by text or voice. Review the details before sending an SOS." },
  { icon: Boxes, title: "Compare supplier offers", copy: "Matching suppliers can quote their quantity, price, preparation time and delivery options." },
  { icon: Truck, title: "Choose and track", copy: "Accept the offer that works for you. Your order and its updates stay in your buyer dashboard." },
];
const supplierSteps = [
  { icon: Building2, title: "Set up your business", copy: "Create a supplier account, add your business details and complete the account review." },
  { icon: PackageSearch, title: "Publish real products", copy: "Add photos, specifications, prices, locations and available quantities to your inventory." },
  { icon: Globe2, title: "Get discovered", copy: "Eligible products appear in search and on a shareable public storefront." },
  { icon: Megaphone, title: "Respond and grow", copy: "Reply to sourcing requests, manage orders and prepare Reach content for approved channels." },
];

function Journey({ steps }: { steps: typeof buyerSteps }) {
  return <ol className="journey-steps">{steps.map((step, index) => { const Icon = step.icon; return <li className="journey-step" key={step.title}><span className="journey-index">0{index + 1}</span><span className="journey-icon"><Icon size={21} /></span><div><h3>{step.title}</h3><p>{step.copy}</p></div></li>; })}</ol>;
}

export default function HowItWorksPage() {
  return <>
    <section className="page-hero journey-hero"><div className="page-container journey-hero-grid"><div><span className="eyebrow"><CheckCircle2 size={14} /> Your guide to StockSOS</span><h1>Trade starts with a clearer next step.</h1><p className="lead">Find stock when you need it. Make your products easier to find when you have it. Explore the journey that fits your business.</p><div className="hero-buttons"><Link className="button button-primary" href="#for-buyers">I’m buying stock <ArrowRight size={16} /></Link><Link className="button button-secondary" href="#for-suppliers">I’m selling stock <ArrowRight size={16} /></Link></div></div><div className="journey-hero-aside"><span className="eyebrow">Two connected workflows</span><Link href="#for-buyers"><PackageSearch size={23} /><span><strong>Buyers</strong><small>Search, request, compare, order</small></span><ArrowUpRight size={16} /></Link><Link href="#for-suppliers"><Building2 size={23} /><span><strong>Suppliers</strong><small>List, respond, fulfil, grow</small></span><ArrowUpRight size={16} /></Link></div></div></section>
    <section className="section journey-section" id="for-buyers"><div className="page-container journey-layout"><div className="journey-intro"><span className="eyebrow">01 / For buyers</span><h2>Find what your business needs.</h2><p>Search first. If the right stock is missing, send a request and decide which supplier offer suits you. You stay in control of every submission and acceptance.</p><Link className="button button-primary" href="/find-stock">Browse available stock <ArrowRight size={16} /></Link><Link className="text-link" href="/sos">Start an SOS request <ArrowRight size={14} /></Link></div><Journey steps={buyerSteps} /></div></section>
    <section className="section journey-section journey-section-alt" id="for-suppliers"><div className="page-container journey-layout"><div className="journey-intro"><span className="eyebrow">02 / For suppliers</span><h2>Make your inventory work harder.</h2><p>Give buyers clear product information, build a shareable storefront, and manage quotes and orders in one workspace. Supplier accounts and public listings are reviewed.</p><Link className="button button-primary" href="/become-supplier">Start as a supplier <ArrowUpRight size={16} /></Link><Link className="text-link" href="/suppliers">Explore supplier storefronts <ArrowRight size={14} /></Link></div><Journey steps={supplierSteps} /></div></section>
    <section className="section reach-guide" id="reach"><div className="page-container reach-explainer"><div><span className="eyebrow"><Globe2 size={14} /> StockSOS Reach</span><h2>Show your products beyond a search result.</h2><p className="lead">Approved suppliers can create public storefronts and prepare promotional content. External channels require their own connection, eligibility checks and supplier authorization.</p><Link className="text-link" href="/pricing">Explore supplier tools <ArrowRight size={15} /></Link></div><div className="reach-explainer-points"><p><BadgeCheck size={18} /> Public pages show approved, available inventory.</p><p><BarChart3 size={18} /> Channel metrics appear only when a connected channel reports them.</p><p><ShieldCheck size={18} /> Suppliers review content and approve any paid campaign.</p></div></div></section>
    <section className="band"><div className="page-container band-inner"><div><h2>Ready to move stock with more clarity?</h2><p>Create an account and choose the role that fits your business.</p></div><Link className="button button-primary" href="/register">Get started <ArrowUpRight size={16} /></Link></div></section>
  </>;
}
