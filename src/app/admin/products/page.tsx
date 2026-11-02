import { CircleAlert, Package, ShieldCheck } from "lucide-react";
import { adminRemoveSupplierProductAction } from "@/app/actions";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string; removed?: string }> }) {
  const params = await searchParams;
  const q = params.q?.trim().replace(/[%_\\]/g, "").slice(0, 80) ?? "";
  const supabase = await createSupabaseServerClient();
  let query = supabase!.from("products")
    .select("id,name,brand,is_active,visibility,created_at,businesses(name,city,country)")
    .is("removed_at", null).order("created_at", { ascending: false }).limit(100);
  if (q) query = query.ilike("name", `%${q}%`);
  const { data: products, error } = await query;

  return <>
    <div className="admin-page-heading"><div><span className="eyebrow"><Package size={14} /> Marketplace listings</span><h1>Review supplier products.</h1><p>Remove a listing from the public marketplace while retaining its details and media privately for authorized case review.</p></div><span className="pill"><ShieldCheck size={12} /> Admin only</span></div>
    {params.removed ? <div className="notice success-notice" role="status"><div><strong>Listing removed.</strong><p>The record is available in Removed records.</p></div></div> : null}
    {params.error || error ? <div className="notice error-notice" role="alert"><CircleAlert size={18} /><div><strong>{params.error === "media_cleanup" ? "The listing was hidden, but public media needs cleanup." : params.error === "evidence" ? "Removal stopped before changing the listing." : "The listing could not be removed or loaded."}</strong><p>{params.error === "media_cleanup" ? "Use Removed records to retry cleanup." : "Check the listing and private evidence storage, then try again."}</p></div></div> : null}
    <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Current listings</h2><Package size={18} /></div>
      <form className="admin-filter-bar" action="/admin/products"><input name="q" defaultValue={q} placeholder="Search product name" aria-label="Search listings" /><button className="button button-secondary button-small" type="submit">Search</button></form>
      {products?.length ? <div className="admin-directory">{products.map((product) => {
        const business = Array.isArray(product.businesses) ? product.businesses[0] : product.businesses;
        return <article className="admin-directory-row" key={product.id}><div><strong>{product.name}</strong><p className="muted small">{business?.name || "Supplier"} · {[business?.city, business?.country].filter(Boolean).join(", ")} · {product.brand || "No brand"}</p><span className={`pill ${product.is_active && product.visibility === "public" ? "pill-green" : "pill-orange"}`}>{product.is_active && product.visibility === "public" ? "Live" : "Hidden"}</span></div><form className="admin-action-row" action={adminRemoveSupplierProductAction}><input type="hidden" name="product_id" value={product.id} /><input name="reason" required minLength={10} maxLength={500} placeholder="Reason for removal" aria-label={`Removal reason for ${product.name}`} /><ConfirmDeleteButton message="Remove this supplier listing and keep its evidence privately?">Remove listing</ConfirmDeleteButton></form></article>;
      })}</div> : !error ? <p className="muted small">No listings match this search.</p> : null}
    </section>
  </>;
}
