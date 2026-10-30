import Link from "next/link";
import { ArrowRight, BarChart3, BadgeCheck, Globe2, Megaphone, PackageSearch, Radio, Search, Share2, Store } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";

export const dynamic = "force-dynamic";

type Business = { id: string; name: string; slug: string; city: string; verification_status: string; visibility: string };
type Product = { id: string; name: string; is_active: boolean; visibility: string; inventory: { quantity_available: number } | { quantity_available: number }[] | null };

export default async function SupplierReachPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <section className="page-container section-tight"><SupabaseSetupNotice /></section>;
  const { data: membershipRows } = await supabase.from("business_memberships").select("business_id,role,businesses(id,name,slug,city,verification_status,visibility)").eq("user_id", user.id);
  const memberships = (membershipRows ?? []) as unknown as { business_id: string; role: string; businesses: Business | Business[] | null }[];
  const businesses = memberships.map((row) => Array.isArray(row.businesses) ? row.businesses[0] : row.businesses).filter((business): business is Business => Boolean(business));
  const approved = businesses.filter((business) => business.verification_status === "approved" && business.visibility === "public");
  const ids = approved.map((business) => business.id);
  const { data: productRows } = ids.length ? await supabase.from("products").select("id,name,is_active,visibility,inventory(quantity_available)").in("business_id", ids).order("updated_at", { ascending: false }).limit(100) : { data: [] };
  const products = (productRows ?? []) as unknown as Product[];
  const publicProducts = products.filter((product) => product.is_active && product.visibility === "public" && Number(Array.isArray(product.inventory) ? product.inventory[0]?.quantity_available : product.inventory?.quantity_available) > 0);
  const availableUnits = publicProducts.reduce((sum, product) => sum + Number(Array.isArray(product.inventory) ? product.inventory[0]?.quantity_available : product.inventory?.quantity_available ?? 0), 0);
  if (!approved.length) return <section className="dashboard-shell"><div className="page-container"><SupabaseSetupNotice /><div className="empty-state"><div className="empty-state-icon"><Store size={22} /></div><h3>StockSOS Reach unlocks after supplier approval</h3><p>Once your business is approved, you can publish public storefronts and manage discovery links here.</p><Link className="button button-primary" href="/supplier">Open supplier workspace <ArrowRight size={15} /></Link></div></div></section>;
  return <section className="dashboard-shell"><div className="page-container">
    <div className="dashboard-top"><div><span className="eyebrow"><Globe2 size={14} /> StockSOS Reach</span><h1>Get discovered beyond StockSOS.</h1><p className="muted">Publish eligible inventory to public storefronts and prepare it for future distribution channels.</p></div><Link className="button button-secondary" href="/supplier"><ArrowRight size={15} /> Supplier workspace</Link></div>
    <div className="reach-callout"><span className="reach-callout-icon"><Radio size={18} /></span><div><strong>Upload once. Get discovered across more places.</strong><p>Your public listings are eligible for search discovery when they have accurate photos, specifications, pricing and available stock.</p></div></div>
    <div className="dashboard-grid reach-metrics"><article className="stat-card"><span>Public listings</span><strong>{publicProducts.length}</strong><span className="small">Eligible product pages</span></article><article className="stat-card"><span>Available units</span><strong>{availableUnits.toLocaleString("en-NG")}</strong><span className="small">From live inventory</span></article><article className="stat-card"><span>Public storefronts</span><strong>{approved.length}</strong><span className="small">Approved businesses</span></article><article className="stat-card"><span>Paid campaigns</span><strong>0</strong><span className="small">No advertising connected</span></article></div>
    <div className="dashboard-columns reach-columns"><div>
      <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Discovery channels</h2><Search size={17} color="#087f71" /></div><div className="reach-channel-list"><article className="reach-channel"><span className="reach-channel-icon"><Search size={17} /></span><div><strong>Search engine storefronts</strong><p>Public supplier and product pages are indexable with canonical URLs and structured product data.</p></div><span className="pill pill-green">Active</span></article><article className="reach-channel"><span className="reach-channel-icon"><Globe2 size={17} /></span><div><strong>Google Merchant Center</strong><p>Not connected. Supplier authorization and eligibility checks are required before publishing feeds.</p></div><span className="pill">Not connected</span></article><article className="reach-channel"><span className="reach-channel-icon"><Share2 size={17} /></span><div><strong>Social promotion</strong><p>Prepare shareable product links now. Official account publishing requires supplier authorization.</p></div><span className="pill">Manual sharing</span></article></div></section>
      <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Public product links</h2><BadgeCheck size={17} color="#087f71" /></div>{publicProducts.length ? <div className="reach-product-list">{publicProducts.slice(0, 12).map((product) => <div className="reach-product-row" key={product.id}><span><PackageSearch size={15} /><strong>{product.name}</strong></span><Link className="text-link" href={`/product/${product.id}`} target="_blank">Open public page <ArrowRight size={13} /></Link></div>)}</div> : <p className="muted small">Add accurate public inventory with available quantity to create discoverable product pages.</p>}</section>
    </div><aside>
      <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Storefronts</h2><Store size={17} color="#087f71" /></div>{approved.map((business) => <div className="reach-storefront" key={business.id}><div><strong>{business.name}</strong><span>{business.city}</span></div><Link className="text-link" href={`/business/${business.slug}`} target="_blank">View <ArrowRight size={13} /></Link></div>)}</section>
      <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Analytics</h2><BarChart3 size={17} color="#087f71" /></div><p className="muted small">External impressions, clicks, spend and conversions will appear here only after a verified channel reports them. StockSOS does not invent performance figures.</p><Link className="text-link" href="/contact">Ask about channel setup <ArrowRight size={14} /></Link></section>
      <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Marketing assistant</h2><Megaphone size={17} color="#087f71" /></div><p className="muted small">Use your verified listing details to prepare accurate product copy and social posts. Review every message before sharing.</p><Link className="button button-secondary button-small" href="/supplier">Review inventory</Link></section>
    </aside></div>
  </div></section>;
}
