import Link from "next/link";
import { ArrowRight, BadgeCheck, Bookmark, Building2, MapPin } from "lucide-react";
import { saveSupplierAction } from "@/app/actions";
import { requireBuyer } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SavedSuppliersPage() {
  const user = await requireBuyer();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase!.from("saved_suppliers")
    .select("business_id,created_at,businesses!inner(name,slug,city,area,description,verification_status,visibility)")
    .eq("buyer_id", user.id).order("created_at", { ascending: false }).limit(100);
  const saved = (data ?? []).filter((row) => {
    const business = Array.isArray(row.businesses) ? row.businesses[0] : row.businesses;
    return business?.verification_status === "approved" && business.visibility === "public";
  });
  return <section className="dashboard-shell"><div className="page-container">
    <div className="dashboard-top"><div><span className="eyebrow"><Bookmark size={14} /> Buyer workspace</span><h1>Saved suppliers</h1><p className="muted">Keep your trusted StockSOS businesses close.</p></div><Link className="button button-secondary" href="/suppliers">Browse suppliers <ArrowRight size={14} /></Link></div>
    {saved.length ? <div className="card-grid saved-supplier-grid">{saved.map((row) => {
      const business = Array.isArray(row.businesses) ? row.businesses[0] : row.businesses;
      if (!business) return null;
      return <article className="feature-card saved-supplier-card" key={row.business_id}><span className="feature-icon"><Building2 size={20} /></span><span className="pill pill-green"><BadgeCheck size={12} /> Verified</span><h3>{business.name}</h3><p className="saved-location"><MapPin size={13} /> {[business.area, business.city].filter(Boolean).join(", ")}</p><p>{business.description || "Approved StockSOS supplier"}</p><div className="saved-supplier-actions"><Link className="text-link" href={"/business/" + business.slug}>View profile <ArrowRight size={14} /></Link><form action={saveSupplierAction}><input type="hidden" name="business_id" value={row.business_id} /><input type="hidden" name="slug" value={business.slug} /><input type="hidden" name="intent" value="remove" /><button className="text-link small" type="submit">Remove</button></form></div></article>;
    })}</div> : <div className="empty-state"><div className="empty-state-icon"><Bookmark size={21} /></div><h3>No saved suppliers yet</h3><p>Save an approved supplier from its public profile to find it again here.</p><Link className="button button-primary" href="/suppliers">Browse suppliers <ArrowRight size={14} /></Link></div>}
  </div></section>;
}
