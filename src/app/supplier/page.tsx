import Link from "next/link";
import { ArrowRight, BadgeCheck, Bell, Boxes, Building2, ChartNoAxesCombined, CircleHelp, PackageCheck, PackagePlus, PackageSearch, Store } from "lucide-react";
import { markNotificationReadAction } from "@/app/actions";
import { requireSupplier } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";

export const dynamic = "force-dynamic";

function statusClass(status: string) {
  if (status === "approved") return "pill pill-green";
  if (["rejected", "suspended"].includes(status)) return "pill pill-red";
  return "pill pill-orange";
}

const workspaceLinks = [
  { href: "/supplier/marketplace", label: "Products", description: "Add stock, update prices, and manage your listings.", icon: PackagePlus, action: "Manage products" },
  { href: "/supplier/requests", label: "Buyer requests", description: "Review matched requests and send quotations.", icon: PackageSearch, action: "View requests" },
  { href: "/supplier/orders", label: "Orders", description: "Track accepted offers and update fulfilment.", icon: PackageCheck, action: "Manage orders" },
  { href: "/supplier/reports", label: "Reports", description: "See activity and performance from your account.", icon: ChartNoAxesCombined, action: "Open reports" },
];

export default async function SupplierDashboardPage({ searchParams }: { searchParams: Promise<{ applied?: string; application?: string; error?: string; product?: string; quote?: string; order?: string; image?: string }> }) {
  const user = await requireSupplier();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const membershipResult = await supabase!.from("business_memberships")
    .select("business_id,role,businesses(id,name,slug,city,verification_status,visibility)")
    .eq("user_id", user.id).order("created_at");
  const memberships = (membershipResult.data ?? []) as unknown as {
    business_id: string;
    role: string;
    businesses: { id: string; name: string; slug: string; city: string; verification_status: string; visibility: string } | { id: string; name: string; slug: string; city: string; verification_status: string; visibility: string }[] | null;
  }[];
  const businesses = memberships.map((membership) => Array.isArray(membership.businesses) ? membership.businesses[0] : membership.businesses)
    .filter((business): business is NonNullable<typeof business> => Boolean(business));
  const businessIds = businesses.map((business) => business.id);
  const approvedIds = businesses.filter((business) => business.verification_status === "approved").map((business) => business.id);
  const [productsResult, matchesResult, ordersResult, notificationResult] = await Promise.all([
    approvedIds.length
      ? supabase!.from("products").select("id,is_active").in("business_id", approvedIds)
      : Promise.resolve({ data: [] }),
    approvedIds.length
      ? supabase!.from("supplier_matches").select("id", { count: "exact", head: true }).in("business_id", approvedIds).eq("status", "matched")
      : Promise.resolve({ count: 0 }),
    businessIds.length
      ? supabase!.from("orders").select("id,status").in("business_id", businessIds).order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [] }),
    supabase!.from("notifications").select("id,title,body,read_at,created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
  ]);
  const products = productsResult.data ?? [];
  const orders = ordersResult.data ?? [];
  const notifications = notificationResult.data ?? [];
  const activeProducts = products.filter((product) => product.is_active).length;
  const openMatches = matchesResult.count ?? 0;
  const ordersInProgress = orders.filter((order) => ["paid", "preparing", "ready_for_pickup", "dispatched", "delivered"].includes(order.status)).length;
  const completedOrders = orders.filter((order) => order.status === "completed").length;

  return (
    <section className="dashboard-shell supplier-home">
      <div className="page-container">
        <div className="dashboard-top">
          <div>
            <span className="eyebrow"><Building2 size={14} /> Supplier workspace</span>
            <h1>Your business, at a glance.</h1>
            <p className="muted">Choose a task to manage products, respond to buyers, or fulfil orders.</p>
          </div>
          <Link className="button button-primary" href={businesses.length ? "/supplier/marketplace/new" : "/become-supplier"}>
            {businesses.length ? <PackagePlus size={16} /> : <Building2 size={16} />}
            {businesses.length ? "Add a product" : "Add your business"}
          </Link>
        </div>
        <SupabaseSetupNotice />
        {params.application === "created" ? <div className="notice success-notice" role="status"><div><strong>Business application submitted successfully.</strong><p>Your supplier workspace is ready. Add products to make your stock discoverable.</p></div></div> : null}
        {params.applied ? <div className="notice success-notice" role="status"><div><strong>Application submitted.</strong><p>You can follow its review status in your supplier workspace.</p></div></div> : null}
        {params.error ? <div className="notice error-notice" role="alert"><div><strong>We couldn’t complete that action.</strong><p>Refresh your workspace and try again. If it continues, contact support.</p></div></div> : null}
        {params.quote === "sent" ? <div className="notice success-notice" role="status"><div><strong>Quotation sent.</strong><p>The buyer can now review your offer.</p></div></div> : null}
        {params.order === "updated" ? <div className="notice success-notice" role="status"><div><strong>Order updated.</strong><p>The new fulfilment status is visible in your order history.</p></div></div> : null}
        {params.product ? <div className="notice success-notice" role="status"><div><strong>{params.product === "created" ? "Product added." : params.product === "updated" ? "Inventory updated." : params.product === "deleted" ? "Listing deleted." : params.product === "archived" ? "Listing archived." : "Product action completed."}</strong><p>{params.product === "archived" ? "This listing has order history, so it was hidden and preserved." : "Your product list is up to date."}</p></div></div> : null}
        {params.image === "error" ? <div className="notice error-notice" role="alert"><div><strong>Product photo needs attention.</strong><p>The inventory was saved, but its photo could not be linked. Edit the listing to try again.</p></div></div> : null}

        {!businesses.length ? (
          <section className="panel supplier-first-step">
            <span className="empty-state-icon"><Building2 size={22} /></span>
            <div><span className="eyebrow">First step</span><h2>Set up your supplier business</h2><p>Tell buyers who you are and what you sell. Once your business is approved, you can publish stock and respond to buyer requests.</p></div>
            <Link className="button button-primary" href="/become-supplier">Start business setup <ArrowRight size={15} /></Link>
          </section>
        ) : (
          <>
            <section className="supplier-business-list" aria-label="Your businesses">
              {businesses.map((business) => <div className="supplier-business-chip" key={business.id}>
                <span className="supplier-business-icon"><Store size={17} /></span>
                <span><strong>{business.name}</strong><small>{business.city || "Business location not set"}</small></span>
                <span className={statusClass(business.verification_status)}>{business.verification_status.replaceAll("_", " ")}</span>
              </div>)}
              <Link className="supplier-add-business" href="/become-supplier"><Building2 size={15} /> Add another business</Link>
            </section>
            {!approvedIds.length ? <div className="notice supplier-approval-note"><BadgeCheck size={18} /><div><strong>Your business is being reviewed.</strong><p>Product publishing and buyer-request matching will be available when approval is complete. You can check back here for updates.</p></div></div> : (
              <>
                <div className="dashboard-grid supplier-stats">
                  <article className="stat-card"><span>Active products</span><strong>{activeProducts}</strong><span className="small">Listings buyers can discover</span></article>
                  <article className="stat-card"><span>Matched requests</span><strong>{openMatches}</strong><span className="small">Buyer needs ready for a quotation</span></article>
                  <article className="stat-card"><span>Orders in progress</span><strong>{ordersInProgress}</strong><span className="small">Orders to prepare or deliver</span></article>
                  <article className="stat-card"><span>Completed orders</span><strong>{completedOrders}</strong><span className="small">From your recent order history</span></article>
                </div>
                <section className="supplier-task-section" aria-labelledby="supplier-tasks-title">
                  <div className="supplier-task-heading"><div><span className="eyebrow">Your workspace</span><h2 id="supplier-tasks-title">What would you like to do?</h2></div><p className="muted small">Each area has its own page, so it’s easy to find the right tools.</p></div>
                  <div className="supplier-task-grid">{workspaceLinks.map(({ href, label, description, icon: Icon, action }) => (
                    <Link className="supplier-task-card" href={href} key={href}>
                      <span className="supplier-task-icon"><Icon size={19} /></span>
                      <span className="supplier-task-copy"><strong>{label}</strong><small>{description}</small></span>
                      <span className="supplier-task-action">{action}<ArrowRight size={14} /></span>
                    </Link>
                  ))}</div>
                </section>
              </>
            )}
            <div className="dashboard-columns supplier-home-columns">
              <section className="panel dashboard-section">
                <div className="dashboard-section-head"><div><h2>Recent notifications</h2><p className="muted small">Important updates about your business and orders.</p></div><Bell size={17} color="#246bfe" /></div>
                {notifications.length ? <div className="notification-list">{notifications.map((notification) => <article className={notification.read_at ? "notification-row" : "notification-row notification-unread"} key={notification.id}>
                  <div className="notification-copy"><strong>{notification.title}</strong><p>{notification.body}</p><small>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.created_at))}</small></div>
                  {!notification.read_at ? <form action={markNotificationReadAction}><input type="hidden" name="notification_id" value={notification.id} /><input type="hidden" name="return_to" value="/supplier" /><button className="text-link small" type="submit">Mark read</button></form> : null}
                </article>)}</div> : <div className="empty-notice"><Bell size={17} /><span>No notifications yet. Updates will appear here.</span></div>}
              </section>
              <aside className="panel supplier-help-card"><span className="supplier-task-icon"><CircleHelp size={19} /></span><h2>Need a hand?</h2><p>Get help with product listings, quotations, or order fulfilment.</p><Link className="text-link" href="/contact">Contact StockSOS support <ArrowRight size={14} /></Link><Link className="supplier-secondary-link" href="/supplier/reach"><Boxes size={15} /> Explore StockSOS Reach</Link></aside>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
