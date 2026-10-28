import Link from "next/link";
import { ArrowRight, BadgeCheck, Boxes, Building2, PackageCheck, PackagePlus, PackageSearch, ShieldCheck, Truck } from "lucide-react";
import { createSupplierProductAction, submitQuotationAction, updateSupplierOrderStatusAction, updateSupplierProductAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { getCategories, formatNaira } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";

export const dynamic = "force-dynamic";

function statusClass(status: string) {
  if (["completed", "paid", "approved", "delivered"].includes(status)) return "pill pill-green";
  if (["cancelled", "rejected", "suspended"].includes(status)) return "pill pill-red";
  if (["awaiting_payment", "pending", "preparing"].includes(status)) return "pill pill-orange";
  return "pill";
}

export default async function SupplierDashboardPage({ searchParams }: { searchParams: Promise<{ applied?: string; error?: string; product?: string; quote?: string; order?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [membershipResult, categoryList] = await Promise.all([
    supabase!.from("business_memberships").select("business_id,role,businesses(id,name,slug,city,verification_status,primary_category_id,visibility)").eq("user_id", user.id).order("created_at"),
    getCategories(),
  ]);
  const memberships = (membershipResult.data ?? []) as unknown as { business_id: string; role: string; businesses: { id: string; name: string; slug: string; city: string; verification_status: string; primary_category_id: string; visibility: string } | { id: string; name: string; slug: string; city: string; verification_status: string; primary_category_id: string; visibility: string }[] | null }[];
  const businesses = memberships.map((membership) => Array.isArray(membership.businesses) ? membership.businesses[0] : membership.businesses).filter((business): business is NonNullable<typeof business> => Boolean(business));
  const approvedIds = businesses.filter((business) => business.verification_status === "approved").map((business) => business.id);
  const [productsResult, matchResult, orderResult] = approvedIds.length ? await Promise.all([
    supabase!.from("products").select("id,name,brand,specifications,category_id,condition,is_active,visibility,business_id,inventory(quantity_available,unit_price_kobo)").in("business_id", approvedIds).order("created_at", { ascending: false }).limit(30),
    supabase!.from("supplier_matches").select("id,request_id,business_id,sos_requests!inner(id,category_id,product_name,quantity,city,area,urgency,delivery_method,specifications,expires_at,status,created_at)").in("business_id", approvedIds).eq("status", "matched").limit(30),
    supabase!.from("orders").select("id,status,total_kobo,created_at,business_id,request_id,quotations(delivery_available)").in("business_id", approvedIds).order("created_at", { ascending: false }).limit(20),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const products = (productsResult.data ?? []) as unknown as { id: string; name: string; brand: string | null; specifications: string | null; category_id: string; condition: string; is_active: boolean; visibility: string; business_id: string; inventory: { quantity_available: number; unit_price_kobo: number } | { quantity_available: number; unit_price_kobo: number }[] | null }[];
  const matches = (matchResult.data ?? []) as unknown as { id: string; request_id: string; business_id: string; sos_requests: { id: string; category_id: string; product_name: string; quantity: number; city: string; area: string | null; urgency: string; delivery_method: string; specifications: string | null; expires_at: string; status: string; created_at: string } | { id: string; category_id: string; product_name: string; quantity: number; city: string; area: string | null; urgency: string; delivery_method: string; specifications: string | null; expires_at: string; status: string; created_at: string }[] | null }[];
  const orders = (orderResult.data ?? []) as unknown as { id: string; status: string; total_kobo: number; created_at: string; business_id: string; request_id: string; quotations: { delivery_available: boolean } | { delivery_available: boolean }[] | null }[];
  const activeProductCount = products.filter((product) => product.is_active).length;
  const pendingOrderCount = orders.filter((order) => ["paid", "preparing", "ready_for_pickup", "dispatched", "delivered"].includes(order.status)).length;
  const completeCount = orders.filter((order) => order.status === "completed").length;

  return (
    <section className="dashboard-shell">
      <div className="page-container">
        <div className="dashboard-top">
          <div><span className="eyebrow"><Building2 size={14} /> Supplier workspace</span><h1>Sell stock with confidence.</h1><p className="muted">Manage business listings, matched requests and orders.</p></div>
          <Link className="button button-primary" href="/become-supplier"><Building2 size={16} /> Add a business</Link>
        </div>
        <SupabaseSetupNotice />
        {params.applied ? <div className="notice success-notice"><div><strong>Application submitted.</strong><p>Marketplace access unlocks after verification review.</p></div></div> : null}
        {params.error ? <div className="notice error-notice"><div><strong>We couldn’t complete that action.</strong><p>Refresh your workspace and try again. If it continues, contact support.</p></div></div> : null}
        {!businesses.length ? <div className="empty-state"><div className="empty-state-icon"><Building2 size={22} /></div><h3>Apply to join as a supplier</h3><p>Your business needs approval before you can publish public stock or quote on SOS requests.</p><Link className="button button-primary" href="/become-supplier">Start supplier application <ArrowRight size={15} /></Link></div> : (
          <>
            <div className="business-switcher">{businesses.map((business) => <span className={statusClass(business.verification_status)} key={business.id}><Building2 size={12} />{business.name} · {business.verification_status}</span>)}</div>
            <div className="dashboard-grid">
              <article className="stat-card"><span>Active listings</span><strong>{activeProductCount}</strong><span className="small">Real items in your inventory</span></article>
              <article className="stat-card"><span>Incoming SOS matches</span><strong>{matches.length}</strong><span className="small">Relevant open requests loaded</span></article>
              <article className="stat-card"><span>Orders in progress</span><strong>{pendingOrderCount}</strong><span className="small">Paid or in fulfilment</span></article>
              <article className="stat-card"><span>Completed orders</span><strong>{completeCount}</strong><span className="small">From recent order history</span></article>
            </div>
            {!approvedIds.length ? <div className="notice"><ShieldCheck size={17} /><div><strong>Verification review is pending.</strong><p>Your business profile is saved. An administrator must approve it before you can list stock or answer requests.</p></div></div> : (
              <div className="dashboard-columns supplier-columns">
                <div>
                  <section className="panel dashboard-section">
                    <div className="dashboard-section-head"><h2>Incoming SOS requests</h2><span className="muted small">Matched by category, city and stock</span></div>
                    {matches.length ? <div className="supplier-request-list">{matches.map((match) => {
                      const request = Array.isArray(match.sos_requests) ? match.sos_requests[0] : match.sos_requests;
                      const business = businesses.find((item) => item.id === match.business_id);
                      if (!request || !business) return null;
                      const businessProducts = products.filter((product) => product.business_id === business.id && product.is_active);
                      return <article className="supplier-request" key={match.id}>
                        <div className="request-summary-head"><div><span className="pill pill-orange">{request.urgency.replaceAll("_", " ")}</span><h3>{request.product_name}</h3><p className="muted small">{request.quantity} requested · {[request.area, request.city].filter(Boolean).join(", ")}</p></div><span className="pill">Open</span></div>
                        {request.specifications ? <p className="request-specs">{request.specifications}</p> : null}
                        <form className="quote-form" action={submitQuotationAction}>
                          <input type="hidden" name="request_id" value={request.id} /><input type="hidden" name="business_id" value={business.id} />
                          <div className="form-grid">
                            <div className="form-field"><label htmlFor={"price-" + match.id}>Unit price (₦)</label><input id={"price-" + match.id} name="price" type="number" min="0.01" step="0.01" required /></div>
                            <div className="form-field"><label htmlFor={"quantity-" + match.id}>Quantity offered</label><input id={"quantity-" + match.id} name="quantity" type="number" min="1" max="1000000" defaultValue={request.quantity} required /></div>
                          </div>
                          <div className="form-grid">
                            <div className="form-field"><label htmlFor={"product-" + match.id}>Inventory listing <span className="muted">(optional)</span></label><select id={"product-" + match.id} name="product_id" defaultValue=""><option value="">Manual availability confirmation</option>{businessProducts.filter((product) => product.category_id === request.category_id).map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></div>
                            <div className="form-field"><label htmlFor={"fee-" + match.id}>Delivery fee (₦)</label><input id={"fee-" + match.id} name="delivery_fee" type="number" min="0" step="0.01" defaultValue="0" /></div>
                          </div>
                          <div className="form-grid">
                            <div className="form-field"><label htmlFor={"delivery-" + match.id}>Can you deliver?</label><select id={"delivery-" + match.id} name="delivery_available" defaultValue="no"><option value="no">Pickup only</option><option value="yes">Delivery available</option></select></div>
                            <div className="form-field"><label htmlFor={"prep-" + match.id}>Preparation time (minutes)</label><input id={"prep-" + match.id} name="preparation_minutes" type="number" min="0" max="10080" /></div>
                          </div>
                          <div className="form-field"><label htmlFor={"note-" + match.id}>Offer note <span className="muted">(optional)</span></label><input id={"note-" + match.id} name="note" maxLength={500} placeholder="Condition, pickup details or product match" /></div>
                          <button className="button button-primary button-small" type="submit">Send quotation <ArrowRight size={14} /></button>
                        </form>
                      </article>;
                    })}</div> : <div className="empty-state"><div className="empty-state-icon"><PackageSearch size={21} /></div><h3>No incoming matches</h3><p>When a buyer request matches your approved business category, city and available public inventory, it will appear here.</p></div>}
                  </section>
                  <section className="panel dashboard-section">
                    <div className="dashboard-section-head"><h2>Recent orders</h2><PackageCheck size={17} color="#246bfe" /></div>
                    {orders.length ? <div className="order-list">{orders.map((order) => <div className="order-row" key={order.id}><span className="order-icon"><PackageCheck size={17} /></span><span className="order-copy"><strong>Order #{order.id.slice(0, 8)}</strong><small>{new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(order.created_at))} · {formatNaira(order.total_kobo)}</small></span><span className={statusClass(order.status)}>{order.status.replaceAll("_", " ")}</span>{order.status === "paid" || order.status === "preparing" ? <form action={updateSupplierOrderStatusAction}><input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="status" value={order.status === "paid" ? "preparing" : "ready_for_pickup"} /><button className="button button-secondary button-small" type="submit">{order.status === "paid" ? "Start preparing" : "Mark ready"}</button></form> : <Link className="text-link" href={"/orders/" + order.id}><ArrowRight size={15} /></Link>}</div>)}</div> : <p className="muted small">Accepted quotations will become orders and appear here.</p>}
                  </section>
                </div>
                <aside>
                  <section className="panel dashboard-section">
                    <div className="dashboard-section-head"><h2>Add inventory</h2><PackagePlus size={17} color="#246bfe" /></div>
                    {products.length ? <div className="inventory-mini-list">{products.slice(0, 8).map((product) => {
                      const stock = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
                      return <details className="inventory-edit" key={product.id}><summary className="inventory-mini-row"><span><strong>{product.name}</strong><small>{product.is_active ? product.visibility : "inactive"} · {stock?.quantity_available ?? 0} available</small></span><b>{stock ? formatNaira(stock.unit_price_kobo) : "—"}</b></summary><form action={updateSupplierProductAction} className="inventory-edit-form">
                        <input type="hidden" name="product_id" value={product.id} />
                        <div className="form-field"><label htmlFor={"edit-name-" + product.id}>Product name</label><input id={"edit-name-" + product.id} name="name" defaultValue={product.name} required maxLength={180} /></div>
                        <div className="form-field"><label htmlFor={"edit-brand-" + product.id}>Brand</label><input id={"edit-brand-" + product.id} name="brand" defaultValue={product.brand ?? ""} maxLength={120} /></div>
                        <div className="form-grid"><div className="form-field"><label htmlFor={"edit-quantity-" + product.id}>Available quantity</label><input id={"edit-quantity-" + product.id} name="quantity" type="number" min="0" max="1000000" defaultValue={stock?.quantity_available ?? 0} required /></div><div className="form-field"><label htmlFor={"edit-price-" + product.id}>Unit price (₦)</label><input id={"edit-price-" + product.id} name="price" type="number" min="0" step="0.01" defaultValue={Number(stock?.unit_price_kobo ?? 0) / 100} required /></div></div>
                        <div className="form-grid"><div className="form-field"><label htmlFor={"edit-condition-" + product.id}>Condition</label><select id={"edit-condition-" + product.id} name="condition" defaultValue={product.condition}><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></div><div className="form-field"><label htmlFor={"edit-visibility-" + product.id}>Visibility</label><select id={"edit-visibility-" + product.id} name="visibility" defaultValue={product.visibility}><option value="public">Public</option><option value="private">Private</option></select></div></div>
                        <div className="form-field"><label htmlFor={"edit-specs-" + product.id}>Specifications</label><textarea id={"edit-specs-" + product.id} name="specifications" defaultValue={product.specifications ?? ""} maxLength={1000} /></div>
                        <div className="form-field"><label htmlFor={"edit-active-" + product.id}>Listing</label><select id={"edit-active-" + product.id} name="is_active" defaultValue={product.is_active ? "yes" : "no"}><option value="yes">Active</option><option value="no">Hidden</option></select></div>
                        <button className="button button-secondary button-small" type="submit">Save inventory</button>
                      </form></details>;
                    })}</div> : <p className="muted small">No inventory listings yet.</p>}
                    <hr className="form-divider" />
                    <form action={createSupplierProductAction}>
                      <div className="form-field"><label htmlFor="business_id">Business</label><select id="business_id" name="business_id" required>{approvedIds.map((id) => <option value={id} key={id}>{businesses.find((business) => business.id === id)?.name}</option>)}</select></div>
                      <div className="form-field"><label htmlFor="category_id">Category</label><select id="category_id" name="category_id" required defaultValue=""><option value="" disabled>Select a category</option>{categoryList.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div>
                      <div className="form-field"><label htmlFor="name">Product name</label><input id="name" name="name" required minLength={2} maxLength={180} /></div>
                      <div className="form-grid"><div className="form-field"><label htmlFor="quantity">Available quantity</label><input id="quantity" name="quantity" type="number" min="0" max="1000000" defaultValue="0" required /></div><div className="form-field"><label htmlFor="price">Unit price (₦)</label><input id="price" name="price" type="number" min="0" step="0.01" defaultValue="0" required /></div></div>
                      <div className="form-grid"><div className="form-field"><label htmlFor="condition">Condition</label><select id="condition" name="condition"><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></div><div className="form-field"><label htmlFor="visibility">Visibility</label><select id="visibility" name="visibility"><option value="public">Public</option><option value="private">Private</option></select></div></div>
                      <div className="form-field"><label htmlFor="brand">Brand <span className="muted">(optional)</span></label><input id="brand" name="brand" maxLength={120} /></div>
                      <div className="form-field"><label htmlFor="specifications">Specifications <span className="muted">(optional)</span></label><textarea id="specifications" name="specifications" maxLength={1000} /></div>
                      <button className="button button-primary form-submit" type="submit"><PackagePlus size={15} /> Add product</button>
                    </form>
                  </section>
                  <section className="panel quick-links"><h2>Supplier tools</h2>{businesses.find((business) => business.visibility === "public") ? <Link href={"/business/" + businesses.find((business) => business.visibility === "public")?.slug}><Boxes size={16} /> Public business profile <ArrowRight size={14} /></Link> : null}<Link href="/pricing"><BadgeCheck size={16} /> Plans and pricing <ArrowRight size={14} /></Link><Link href="/contact"><Truck size={16} /> Supplier support <ArrowRight size={14} /></Link></section>
                </aside>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
