import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, MapPin } from "lucide-react";
import { getPublicBusinesses } from "@/lib/data";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const businesses = await getPublicBusinesses();
  return (
    <>
      <section className="page-hero"><div className="page-container"><span className="eyebrow"><BadgeCheck size={14} /> Approved businesses</span><h1>Meet StockSOS suppliers.</h1><p className="lead">Browse businesses that have completed supplier approval and made their profile public.</p></div></section>
      <section className="section-tight"><div className="page-container">
        <SupabaseSetupNotice />
        {businesses.length ? <div className="card-grid">{businesses.map((business) => <article className="feature-card" key={business.id}>
          <span className="feature-icon"><Building2 size={20} /></span><span className="pill pill-green"><BadgeCheck size={12} /> Approved</span>
          <h3 style={{ marginTop: 12 }}>{business.name}</h3>
          <p><MapPin size={13} /> {[business.area, business.city].filter(Boolean).join(", ")}</p>
          {business.description ? <p>{business.description}</p> : null}
          <Link className="text-link" href={"/business/" + business.slug}>View business <ArrowRight size={14} /></Link>
        </article>)}</div> : <div className="empty-state"><div className="empty-state-icon"><Building2 size={22} /></div><h3>Supplier profiles will appear after approval</h3><p>Only real businesses that pass the platform’s review are shown here.</p><Link className="button button-primary" href="/become-supplier">Apply as a supplier <ArrowRight size={14} /></Link></div>}
      </div></section>
    </>
  );
}
