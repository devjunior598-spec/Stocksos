import Link from "next/link";
import { ArrowRight, Boxes } from "lucide-react";
import { getCategories } from "@/lib/data";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await getCategories();
  return (
    <>
      <section className="page-hero"><div className="page-container"><span className="eyebrow">Marketplace categories</span><h1>Find the right kind of stock.</h1><p className="lead">Browse the business categories supported by StockSOS.</p></div></section>
      <section className="section-tight"><div className="page-container">
        <SupabaseSetupNotice />
        {categories.length ? <div className="card-grid">{categories.map((category) => <Link className="feature-card" href={"/find-stock?category=" + category.id} key={category.id}><span className="feature-icon"><Boxes size={19} /></span><h3>{category.name}</h3><span className="text-link">Explore listings <ArrowRight size={14} /></span></Link>)}</div> : <div className="empty-state"><div className="empty-state-icon"><Boxes size={22} /></div><h3>Categories will appear here</h3><p>Connect the marketplace database and apply its category seed data to browse supported stock types.</p></div>}
      </div></section>
    </>
  );
}
