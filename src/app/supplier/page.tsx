import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BadgeCheck, Bell, Boxes, Building2, PackageCheck, PackagePlus, PackageSearch, ShieldCheck, Truck, Globe2 } from "lucide-react";
import { createSupplierProductAction, deleteSupplierProductAction, markNotificationReadAction, submitQuotationAction, updateSupplierOrderStatusAction, updateSupplierProductAction } from "@/app/actions";
import { requireSupplier } from "@/lib/auth";
import { getCategories, formatMoney, getMarketplaceImageUrl } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { InventoryImageField } from "@/components/inventory-image-field";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

export const dynamic = "force-dynamic";

function statusClass(status: string) {
  if (["completed", "paid", "approved", "delivered"].includes(status)) return "pill pill-green";
  if (["cancelled", "rejected", "suspended"].includes(status)) return "pill pill-red";
  if (["awaiting_payment", "pending", "preparing"].includes(status)) return "pill pill-orange";
  return "pill";
}

export default async function SupplierDashboardPage({ searchParams }: { searchParams: Promise<{ applied?: string; application?: string; error?: string; product?: string; quote?: string; order?: string; image?: string }> }) {
  const user = await requireSupplier();
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
    supabase!.from("products").select("id,name,brand,specifications,image_path,media_paths,category_id,condition,is_active,visibility,business_id,inventory(quantity_available,unit_price_kobo,currency)").in("business_id", approvedIds).order("created_at", { ascending: false }).limit(30),
    supabase!.from("supplier_matches").select("id,request_id,business_id,match_score,reason_codes,sos_requests!inner(id,category_id,product_name,quantity,city,area,urgency,delivery_method,specifications,expires_at,status,created_at)").in("business_id", approvedIds).eq("status", "matched").limit(30),
    supabase!.from("orders").select("id,status,total_kobo,currency,created_at,business_id,request_id,quotations(delivery_available)").in("business_id", approvedIds).order("created_at", { ascending: false }).limit(20),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const products = (productsResult.data ?? []) as unknown as { id: string; name: string; brand: string | null; specifications: string | null; image_path: string | null; media_paths: string[]; category_id: string; condition: string; is_active: boolean; visibility: string; business_id: string; inventory: { quantity_available: number; unit_price_kobo: number; currency: string } | { quantity_available: number; unit_price_kobo: number; currency: string }[] | null }[];
  const matches = (matchResult.data ?? []) as unknown as { id: string; request_id: string; business_id: string; match_score: number; reason_codes: string[]; sos_requests: { id: string; category_id: string; product_name: string; quantity: number; city: string; area: string | null; urgency: string; delivery_method: string; specifications: string | null; expires_at: string; status: string; created_at: string } | { id: string; category_id: string; product_name: string; quantity: number; city: string; area: string | null; urgency: string; delivery_method: string; specifications: string | null; expires_at: string; status: string; created_at: string }[] | null }[];
  const orders = (orderResult.data ?? []) as unknown as { id: string; status: string; total_kobo: number; currency: string; created_at: string; business_id: string; request_id: string; quotations: { delivery_available: boolean } | { delivery_available: boolean }[] | null }[];
  const activeProductCount = products.filter((product) => product.is_active).length;
  const pendingOrderCount = orders.filter((order) => ["paid", "preparing", "ready_for_pickup", "dispatched", "delivered"].includes(order.status)).length;
  const completeCount = orders.filter((order) => order.status === "completed").length;
  const notificationResult = await supabase!.from("notifications")
    .select("id,title,body,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6);
  const notifications = notificationResult.data ?? [];
  const manageableBusinessIds = memberships
    .filter((membership) => ["owner", "admin", "inventory"].includes(membership.role))
    .map((membership) => membership.business_id);

  return (
    <section className="dashboard-shell">
      <div className="page-container">
        <div className="dashboard-top">
          <div><span className="eyebrow"><Building2 size={14} /> Supplier workspace</span><h1>Sell stock with confidence.</h1><p className="muted">Manage business listings, matched requests and orders.</p></div>
          <Link className="button button-primary" href="/become-supplier"><Building2 size={16} /> Add a business</Link>
        </div>
        <SupabaseSetupNotice />
        {params.application === "created" ? <div className="notice success-notice" role="status"><div><strong>Business application submitted successfully.</strong><p>Your approved supplier account is ready. Your business storefront is active, and you can start adding inventory.</p></div></div> : null}
        {params.applied ? <div className="notice success-notice"><div><strong>Application submitted.</strong><p>Marketplace access unlocks after verification review.</p></div></div> : null}
        {params.error ? <div className="notice error-notice"><div><strong>We couldn’t complete that action.</strong><p>Refresh your workspace and try again. If it continues, contact support.</p></div></div> : null}
        {params.quote === "sent" ? <div className="notice success-notice"><div><strong>Quotation sent.</strong><p>The buyer can now review your offer.</p></div></div> : null}
        {params.order === "updated" ? <div className="notice success-notice"><div><strong>Order updated.</strong><p>The new status is visible in your order history.</p></div></div> : null}
        {params.product ? <div className="notice success-notice"><div><strong>{params.product === "created" ? "Product added." : params.product === "updated" ? "Inventory updated." : params.product === "deleted" ? "Listing deleted." : params.product === "archived" ? "Listing archived." : "Product action completed."}</strong><p>{params.product === "archived" ? "This listing has order or quotation history, so it was hidden and preserved." : "Your supplier inventory is up to date."}</p></div></div> : null}
        {params.image === "error" ? <div className="notice error-notice"><div><strong>Product photo needs attention.</strong><p>The inventory was saved, but its photo could not be linked. Edit the listing to try again.</p></div></div> : null}
        {!businesses.length ? <div className="empty-state"><div className="empty-state-icon"><Building2 size={22} /></div><h3>Apply to join as a supplier</h3><p>Your business needs approval before you can publish public stock or quote on SOS requests.</p><Link className="button button-primary" href="/become-supplier">Start supplier application <ArrowRight size={15} /></Link></div> : (
          <>
            <div className="business-switcher">{businesses.map((business) => <span className={statusClass(business.verification_status)} key={business.id}><Building2 size={12} />{business.name} · {business.verification_status}</span>)}</div>
            <div className="dashboard-grid">
              <article className="stat-card"><span>Active listings</span><strong>{activeProductCount}</strong><span className="small">Real items in your inventory</span></article>
              <article className="stat-card"><span>Incoming SOS matches</span><strong>{matches.length}</strong><span className="small">Relevant open requests loaded</span></article>
              <article className="stat-card"><span>Orders in progress</span><strong>{pendingOrderCount}</strong><span className="small">Paid or in fulfilment</span></article>
              <article className="stat-card"><span>Completed orders</span><strong>{completeCount}</strong><span className="small">From recent order history</span></article>
            </div>
            <nav className="supplier-workspace-nav" aria-label="Supplier workspace sections"><Link href="/supplier/marketplace"><PackagePlus size={15} /><span><strong>Products</strong><small>Upload and manage marketplace listings</small></span><ArrowRight size={14} /></Link><Link href="/supplier/requests"><PackageSearch size={15} /><span><strong>Requests</strong><small>Review matched buyer requests</small></span><ArrowRight size={14} /></Link><Link href="/supplier/orders"><PackageCheck size={15} /><span><strong>Orders</strong><small>Track fulfillment</small></span><ArrowRight size={14} /></Link><Link href="/supplier/reports"><Boxes size={15} /><span><strong>Reports</strong><small>Review live activity and stock</small></span><ArrowRight size={14} /></Link></nav>
            {!approvedIds.length ? <div className="notice"><ShieldCheck size={17} /><div><strong>Verification review is pending.</strong><p>Your business profile is saved. An administrator must approve it before you can list stock or answer requests.</p></div></div> : (
              <div className="dashboard-columns supplier-columns">
                <div>
                  <section className="panel dashboard-section" id="supplier-requests">
                    <div className="dashboard-section-head"><h2>Incoming SOS requests</h2><span className="muted small">Matched by category, city and stock</span></div>
                    {matches.length ? <div className="supplier-request-list">{matches.map((match) => {
                      const request = Array.isArray(match.sos_requests) ? match.sos_requests[0] : match.sos_requests;
                      const business = businesses.find((item) => item.id === match.business_id);
                      if (!request || !business) return null;
                      const businessProducts = products.filter((product) => product.business_id === business.id && product.is_active);
                      return <article className="supplier-request" key={match.id}>
                        <div className="request-summary-head"><div><span className="pill pill-orange">{request.urgency.replaceAll("_", " ")}</span><h3>{request.product_name}</h3><p className="muted small">{request.quantity} requested · {[request.area, request.city].filter(Boolean).join(", ")}</p></div><span className="pill">{match.match_score >= 100 ? "Local match" : "Expanded match"}</span></div>
                        {request.specifications ? <p className="request-specs">{request.specifications}</p> : null}
                        <form className="quote-form" action={submitQuotationAction}>
                          <input type="hidden" name="request_id" value={request.id} /><input type="hidden" name="business_id" value={business.id} />
                          <div className="form-grid">
                            <div className="form-field"><label htmlFor={"price-" + match.id}>Unit price (USD)</label><input id={"price-" + match.id} name="price" type="number" min="0.01" step="0.01" required /></div>
                            <div className="form-field"><label htmlFor={"quantity-" + match.id}>Quantity offered</label><input id={"quantity-" + match.id} name="quantity" type="number" min="1" max="1000000" defaultValue={request.quantity} required /></div>
                          </div>
                          <div className="form-grid">
                            <div className="form-field"><label htmlFor={"product-" + match.id}>Inventory listing <span className="muted">(optional)</span></label><select id={"product-" + match.id} name="product_id" defaultValue=""><option value="">Manual availability confirmation</option>{businessProducts.filter((product) => product.category_id === request.category_id).map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></div>
                            <div className="form-field"><label htmlFor={"fee-" + match.id}>Delivery fee (USD)</label><input id={"fee-" + match.id} name="delivery_fee" type="number" min="0" step="0.01" defaultValue="0" /></div>
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
                  <section className="panel dashboard-section" id="supplier-orders">
                    <div className="dashboard-section-head"><h2>Recent orders</h2><PackageCheck size={17} color="#246bfe" /></div>
                    {orders.length ? <div className="order-list">{orders.map((order) => <div className="order-row" key={order.id}><span className="order-icon"><PackageCheck size={17} /></span><span className="order-copy"><strong>Order #{order.id.slice(0, 8)}</strong><small>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(order.created_at))} · {formatMoney(order.total_kobo, order.currency)}</small></span><span className={statusClass(order.status)}>{order.status.replaceAll("_", " ")}</span>{order.status === "paid" || order.status === "preparing" ? <form action={updateSupplierOrderStatusAction}><input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="status" value={order.status === "paid" ? "preparing" : "ready_for_pickup"} /><button className="button button-secondary button-small" type="submit">{order.status === "paid" ? "Start preparing" : "Mark ready"}</button></form> : <Link className="text-link" href={"/orders/" + order.id}><ArrowRight size={15} /></Link>}</div>)}</div> : <p className="muted small">Accepted quotations will become orders and appear here.</p>}
                  </section>
                </div>
                <aside>
                  <section className="panel dashboard-section">
                    <div className="dashboard-section-head"><h2>Notifications</h2><Bell size={17} color="#246bfe" /></div>
                    {notifications.length ? <div className="notification-list">{notifications.map((notification) => <article className={notification.read_at ? "notification-row" : "notification-row notification-unread"} key={notification.id}><div className="notification-copy"><strong>{notification.title}</strong><p>{notification.body}</p><small>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.created_at))}</small></div>{!notification.read_at ? <form action={markNotificationReadAction}><input type="hidden" name="notification_id" value={notification.id} /><input type="hidden" name="return_to" value="/supplier" /><button className="text-link small" type="submit">Mark read</button></form> : null}</article>)}</div> : <div className="empty-notice"><Bell size={17} /><span>No new activity yet.</span></div>}
                  </section>
                  <section className="panel dashboard-section supplier-inventory-section supplier-inventory-legacy" id="supplier-inventory">
                    <div className="dashboard-section-head"><div><h2>Products & media</h2><p className="muted small">Create polished public listings with clear photos, video and accurate stock.</p></div><PackagePlus size={17} color="#246bfe" /></div>
                    {products.length ? <div className="inventory-mini-list">{products.slice(0, 8).map((product) => {
                      const stock = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
                      const imageUrl = getMarketplaceImageUrl(product.image_path);
                      const canEdit = manageableBusinessIds.includes(product.business_id);
                      const canDelete = memberships.some((membership) => membership.business_id === product.business_id && ["owner", "admin"].includes(membership.role));
                      return <details className="inventory-edit" key={product.id}><summary className="inventory-mini-row"><span className="inventory-summary-copy"><span className="inventory-thumb">{imageUrl ? <Image src={imageUrl} alt="" fill unoptimized sizes="42px" className="inventory-thumb-image" /> : <PackageSearch size={17} />}</span><span><strong>{product.name}</strong><small>{product.is_active ? product.visibility : "inactive"} · {stock?.quantity_available ?? 0} available</small></span></span><b>{stock ? formatMoney(stock.unit_price_kobo, stock.currency) : "—"}</b></summary>{canEdit ? <form action={updateSupplierProductAction} className="inventory-edit-form">
                        <input type="hidden" name="product_id" value={product.id} />
                        <input type="hidden" name="business_id" value={product.business_id} />
                        <InventoryImageField id={`edit-photo-${product.id}`} currentPath={product.image_path ?? ""} currentPaths={product.media_paths ?? []} />
                        <div className="form-field"><label htmlFor={"edit-name-" + product.id}>Product name</label><input id={"edit-name-" + product.id} name="name" defaultValue={product.name} required maxLength={180} /></div>
                        <div className="form-field"><label htmlFor={"edit-brand-" + product.id}>Brand</label><input id={"edit-brand-" + product.id} name="brand" defaultValue={product.brand ?? ""} maxLength={120} /></div>
                        <div className="form-grid"><div className="form-field"><label htmlFor={"edit-quantity-" + product.id}>Available quantity</label><input id={"edit-quantity-" + product.id} name="quantity" type="number" min="0" max="1000000" defaultValue={stock?.quantity_available ?? 0} required /></div><div className="form-field"><label htmlFor={"edit-price-" + product.id}>Unit price (USD)</label><input id={"edit-price-" + product.id} name="price" type="number" min="0" step="0.01" defaultValue={Number(stock?.unit_price_kobo ?? 0) / 100} required /></div></div>
                        <div className="form-grid"><div className="form-field"><label htmlFor={"edit-condition-" + product.id}>Condition</label><select id={"edit-condition-" + product.id} name="condition" defaultValue={product.condition}><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></div><div className="form-field"><label htmlFor={"edit-visibility-" + product.id}>Visibility</label><select id={"edit-visibility-" + product.id} name="visibility" defaultValue={product.visibility}><option value="public">Public</option><option value="private">Private</option></select></div></div>
                        <div className="form-field"><label htmlFor={"edit-specs-" + product.id}>Specifications</label><textarea id={"edit-specs-" + product.id} name="specifications" defaultValue={product.specifications ?? ""} maxLength={1000} /></div>
                        <div className="form-field"><label htmlFor={"edit-active-" + product.id}>Listing</label><select id={"edit-active-" + product.id} name="is_active" defaultValue={product.is_active ? "yes" : "no"}><option value="yes">Active</option><option value="no">Hidden</option></select></div>
                        <div className="inventory-actions"><button className="button button-secondary button-small" type="submit">Save inventory</button></div>
                      </form> : <p className="muted small">You have read access to this listing. Ask a business owner, admin or inventory manager to edit it.</p>}{canDelete ? <form action={deleteSupplierProductAction} className="inventory-delete-form"><input type="hidden" name="product_id" value={product.id} /><ConfirmDeleteButton message="Delete this listing? Listings with order history will be archived instead.">Delete listing</ConfirmDeleteButton></form> : null}</details>;
                    })}</div> : <p className="muted small">No inventory listings yet.</p>}
                    <hr className="form-divider" />
                    {manageableBusinessIds.some((id) => approvedIds.includes(id)) ? <form action={createSupplierProductAction}>
                      <div className="form-field"><label htmlFor="business_id">Business</label><select id="business_id" name="business_id" required>{manageableBusinessIds.filter((id) => approvedIds.includes(id)).map((id) => <option value={id} key={id}>{businesses.find((business) => business.id === id)?.name}</option>)}</select></div>
                      <InventoryImageField id="new-product-photo" />
                      <div className="form-field"><label htmlFor="category_id">Category</label><select id="category_id" name="category_id" required defaultValue=""><option value="" disabled>Select a category</option>{categoryList.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div>
                      <div className="form-field"><label htmlFor="name">Product name</label><input id="name" name="name" required minLength={2} maxLength={180} /></div>
                      <div className="form-grid"><div className="form-field"><label htmlFor="quantity">Available quantity</label><input id="quantity" name="quantity" type="number" min="0" max="1000000" defaultValue="0" required /></div><div className="form-field"><label htmlFor="price">Unit price (USD)</label><input id="price" name="price" type="number" min="0" step="0.01" defaultValue="0" required /></div></div>
                      <div className="form-grid"><div className="form-field"><label htmlFor="condition">Condition</label><select id="condition" name="condition"><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></div><div className="form-field"><label htmlFor="visibility">Visibility</label><select id="visibility" name="visibility"><option value="public">Public</option><option value="private">Private</option></select></div></div>
                      <div className="form-field"><label htmlFor="brand">Brand <span className="muted">(optional)</span></label><input id="brand" name="brand" maxLength={120} /></div>
                      <div className="form-field"><label htmlFor="specifications">Specifications <span className="muted">(optional)</span></label><textarea id="specifications" name="specifications" maxLength={1000} /></div>
                      <button className="button button-primary form-submit" type="submit"><PackagePlus size={15} /> Add product</button>
                    </form> : <p className="muted small">You need an owner, admin or inventory manager role to add or change listings.</p>}
                  </section>
                  <section className="panel quick-links"><h2>Supplier tools</h2>{businesses.find((business) => business.visibility === "public") ? <Link href={"/business/" + businesses.find((business) => business.visibility === "public")?.slug}><Boxes size={16} /> Public business profile <ArrowRight size={14} /></Link> : null}<Link href="/supplier/reach"><Globe2 size={16} /> StockSOS Reach <ArrowRight size={14} /></Link><Link href="/pricing"><BadgeCheck size={16} /> Plans and pricing <ArrowRight size={14} /></Link><Link href="/contact"><Truck size={16} /> Supplier support <ArrowRight size={14} /></Link></section>
                </aside>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
