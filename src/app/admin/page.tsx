import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, CircleAlert, CreditCard, Settings2, ShieldCheck, Truck, Activity, ShoppingBag, Boxes } from "lucide-react";
import { adminReviewBusinessAction, adminReviewDeliveryPartnerAction, adminUpdateMarketplaceFeeAction, adminUpdatePlanAction, updateSupportCaseStatusAction } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/actions";
import { formatMoney } from "@/lib/data";

export const dynamic = "force-dynamic";

function countValue(result: { count: number | null }) { return result.count ?? 0; }

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string; reviewed?: string; plan?: string; fee?: string; q?: string; status?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const search = params.q?.trim().replace(/[,%()]/g, "").slice(0, 80) ?? "";
  const supabase = await createSupabaseServerClient();
  const [users, verifiedBusinesses, pendingBusinesses, openRequests, completedOrders, paymentFailures, pendingDrivers, businessList, driverList, supportCases, planList, feeSetting, revenueResult, listedProducts, lowStock, recentOrders, recentAudit, openEnquiries] = await Promise.all([
    supabase!.from("profiles").select("id", { count: "exact", head: true }),
    supabase!.from("businesses").select("id", { count: "exact", head: true }).eq("verification_status", "approved"),
    supabase!.from("businesses").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
    supabase!.from("sos_requests").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase!.from("orders").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase!.from("payments").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase!.from("delivery_partners").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
    supabase!.rpc("admin_pending_businesses"),
    supabase!.from("delivery_partners").select("id,user_id,city,phone,created_at,profiles(full_name)").eq("verification_status", "pending").order("created_at").limit(30),
    supabase!.from("support_cases").select("id,user_id,subject,message,status,created_at,order_id").in("status", ["open", "in_progress"]).order("created_at", { ascending: false }).limit(30),
    supabase!.from("subscription_plans").select("id,name,monthly_price_kobo,benefits,is_active").order("monthly_price_kobo"),
    supabase!.from("platform_settings").select("value").eq("key", "marketplace_fee_bps").maybeSingle(),
    supabase!.rpc("admin_revenue_summary"),
    supabase!.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase!.from("inventory").select("product_id", { count: "exact", head: true }).lte("quantity_available", 5),
    supabase!.from("orders").select("id,status,total_kobo,currency,created_at,businesses(name)").order("created_at", { ascending: false }).limit(8),
    supabase!.from("audit_logs").select("id,action,target_type,target_id,created_at,profiles(full_name)").order("created_at", { ascending: false }).limit(10),
    supabase!.from("business_enquiries").select("id", { count: "exact", head: true }).in("status", ["new", "sourcing"]),
  ]);
  const pendingBusinessList = (businessList.data ?? []) as { id: string; name: string; city: string; area: string | null; phone: string | null; email: string | null; registration_number: string | null; created_at: string; category_name: string | null }[];
  const pendingDriverList = driverList.data ?? [];
  const plans = (planList.data ?? []) as { id: string; name: string; monthly_price_kobo: number; benefits: string[]; is_active: boolean }[];
  const feeBps = Number(feeSetting.data?.value ?? 0);
  const revenue = Array.isArray(revenueResult.data) ? revenueResult.data[0] : revenueResult.data;
  let accountQuery = supabase!.from("profiles").select("id,full_name,phone,home_city,platform_role,created_at").order("created_at", { ascending: false }).limit(30);
  if (search) accountQuery = accountQuery.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,home_city.ilike.%${search}%`);
  const [accountList, inventoryList, supplierList] = await Promise.all([
    accountQuery,
    supabase!.from("products").select("id,name,is_active,visibility,created_at,inventory(quantity_available),businesses(name,city,verification_status)").order("created_at", { ascending: false }).limit(30),
    supabase!.from("businesses").select("id,name,slug,city,verification_status,visibility,created_at").order("created_at", { ascending: false }).limit(30),
  ]);

  return (
    <section className="dashboard-shell admin-console">
      <div className="page-container">
        <header className="admin-console-header"><Link href="/admin" className="brand"><span className="brand-mark"><ShieldCheck size={17} /></span><span>StockSOS <span className="brand-accent">Admin</span></span></Link><nav aria-label="Admin navigation"><a href="#accounts">Accounts</a><a href="#reviews">Verification</a><a href="#orders">Orders</a><a href="#support">Support</a><a href="#activity">Audit</a></nav><form action={signOutAction}><button className="button button-secondary button-small" type="submit">Log out</button></form></header>
        <div className="dashboard-top"><div><span className="eyebrow"><ShieldCheck size={14} /> Platform administration</span><h1>Trust and marketplace operations.</h1><p className="muted">Review applications and manage configured pricing. Sensitive actions are written to the audit log.</p></div><span className="pill pill-green"><BadgeCheck size={12} /> Admin access</span></div>
        {params.error ? <div className="notice error-notice"><div><strong>That admin action did not complete.</strong><p>Check the record and try again.</p></div></div> : null}
        {params.reviewed || params.plan || params.fee ? <div className="notice success-notice"><div><strong>Changes saved.</strong><p>The database recorded the authorized action.</p></div></div> : null}
        <div className="dashboard-grid">
          <article className="stat-card"><span>Registered accounts</span><strong>{countValue(users)}</strong><span className="small">Profiles created</span></article>
          <article className="stat-card"><span>Approved businesses</span><strong>{countValue(verifiedBusinesses)}</strong><span className="small">Active marketplace suppliers</span></article>
          <article className="stat-card"><span>Pending verification</span><strong>{countValue(pendingBusinesses)}</strong><span className="small">Businesses awaiting review</span></article>
          <article className="stat-card"><span>Open SOS requests</span><strong>{countValue(openRequests)}</strong><span className="small">Requests still accepting offers</span></article>
          <article className="stat-card"><span>Completed orders</span><strong>{countValue(completedOrders)}</strong><span className="small">Recorded completed transactions</span></article>
          <article className="stat-card"><span>Failed payments</span><strong>{countValue(paymentFailures)}</strong><span className="small">Provider records marked failed</span></article>
          <article className="stat-card"><span>Delivery applications</span><strong>{countValue(pendingDrivers)}</strong><span className="small">Partners awaiting review</span></article>
          <article className="stat-card"><span>Marketplace fee</span><strong>{(feeBps / 100).toFixed(2)}%</strong><span className="small">Current configured fee</span></article>
          <article className="stat-card"><span>Verified GTV · 30 days</span><strong>{formatMoney(revenue?.gross_transaction_value_kobo ?? 0)}</strong><span className="small">Successful provider-verified payments</span></article>
          <article className="stat-card"><span>Net platform revenue · 30 days</span><strong>{formatMoney(revenue?.net_platform_revenue_kobo ?? 0)}</strong><span className="small">Fees less recorded refunded fees</span></article>
          <article className="stat-card"><span>Active product listings</span><strong>{countValue(listedProducts)}</strong><span className="small">Current inventory records</span></article>
          <article className="stat-card"><span>Low stock listings</span><strong>{countValue(lowStock)}</strong><span className="small">Five units or fewer</span></article>
          <article className="stat-card"><span>Open business enquiries</span><strong>{countValue(openEnquiries)}</strong><span className="small">Awaiting supplier follow-up</span></article>
        </div>
        <nav className="admin-jump-links" aria-label="Admin sections"><a href="#reviews"><Building2 size={15} /> Reviews</a><a href="#orders"><ShoppingBag size={15} /> Orders</a><a href="#support"><CircleAlert size={15} /> Support</a><a href="#activity"><Activity size={15} /> Audit activity</a><a href="#plans"><Settings2 size={15} /> Settings</a></nav>
        <section className="panel dashboard-section" id="accounts"><div className="dashboard-section-head"><h2>Account directory</h2><ShieldCheck size={17} color="#087f71" /></div><form className="admin-search" action="/admin"><input name="q" defaultValue={search} placeholder="Search by name, phone or city" aria-label="Search accounts" /><button className="button button-secondary button-small" type="submit">Search accounts</button></form>{accountList.data?.length ? <div className="admin-directory">{accountList.data.map((account) => <article className="admin-directory-row" key={account.id}><div><strong>{account.full_name || "New account"}</strong><small>{account.phone || "No phone"} · {account.home_city || "No city"} · {account.platform_role}</small></div><small className="muted">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(account.created_at))}</small></article>)}</div> : <p className="muted small">No accounts match this search.</p>}</section>
        <div className="dashboard-columns admin-columns">
          <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Supplier directory</h2><Building2 size={17} color="#087f71" /></div>{supplierList.data?.length ? <div className="admin-directory">{supplierList.data.map((business) => <article className="admin-directory-row" key={business.id}><div><strong>{business.name}</strong><small>{business.city} · {business.visibility}</small></div><span className={`pill${business.verification_status === "approved" ? " pill-green" : business.verification_status === "rejected" || business.verification_status === "suspended" ? " pill-red" : " pill-orange"}`}>{business.verification_status}</span></article>)}</div> : <p className="muted small">No supplier records.</p>}</section>
          <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Inventory oversight</h2><Boxes size={17} color="#087f71" /></div>{inventoryList.data?.length ? <div className="admin-directory">{inventoryList.data.map((product) => { const business = Array.isArray(product.businesses) ? product.businesses[0] : product.businesses; const stock = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory; return <article className="admin-directory-row" key={product.id}><div><strong>{product.name}</strong><small>{business?.name ?? "Supplier"} · {business?.city ?? "—"} · {stock?.quantity_available ?? 0} available</small></div><span className="pill">{product.is_active ? product.visibility : "inactive"}</span></article>; })}</div> : <p className="muted small">No listings found.</p>}</section>
        </div>
        <div className="dashboard-columns admin-columns">
          <div>
            <section className="panel dashboard-section" id="reviews"><div className="dashboard-section-head"><h2>Supplier verification</h2><Building2 size={17} color="#246bfe" /></div>
              {pendingBusinessList.length ? <div className="admin-review-list">{pendingBusinessList.map((business) => <article className="admin-review-card" key={business.id}><div className="request-summary-head"><div><span className="pill pill-orange">Pending</span><h3>{business.name}</h3><p className="muted small">{[business.area, business.city].filter(Boolean).join(", ")} · {business.category_name ?? "Category"}</p></div><span className="muted small">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(business.created_at))}</span></div><p className="small muted">{business.email || "No business email"} · {business.phone || "No phone"}{business.registration_number ? " · Reg: " + business.registration_number : ""}</p><form className="admin-action-row" action={adminReviewBusinessAction}><input type="hidden" name="business_id" value={business.id} /><input name="note" maxLength={500} placeholder="Optional review note" aria-label="Review note" /><button className="button button-primary button-small" name="status" value="approved" type="submit">Approve</button><button className="button button-danger button-small" name="status" value="rejected" type="submit">Request changes</button></form></article>)}</div> : <div className="empty-state"><h3>No pending supplier applications</h3><p>New business applications will appear here for review.</p></div>}
            </section>
            <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Delivery partner verification</h2><Truck size={17} color="#246bfe" /></div>
              {pendingDriverList.length ? <div className="admin-review-list">{pendingDriverList.map((partner) => { const profile = Array.isArray(partner.profiles) ? partner.profiles[0] : partner.profiles; return <article className="admin-review-card" key={partner.id}><div><span className="pill pill-orange">Pending</span><h3>{profile?.full_name || "Delivery applicant"}</h3><p className="muted small">{partner.city} · {partner.phone || "No phone"}</p></div><form className="admin-action-row" action={adminReviewDeliveryPartnerAction}><input type="hidden" name="partner_id" value={partner.id} /><button className="button button-primary button-small" name="status" value="approved" type="submit">Approve</button><button className="button button-danger button-small" name="status" value="rejected" type="submit">Reject</button></form></article>; })}</div> : <p className="muted small">No delivery applications need review.</p>}
            </section>
            <section className="panel dashboard-section" id="support"><div className="dashboard-section-head"><h2>Open support cases</h2><CircleAlert size={17} color="#246bfe" /></div>
              {supportCases.data?.length ? <div className="admin-review-list">{supportCases.data.map((ticket) => <article className="admin-review-card" key={ticket.id}><span className="pill">{ticket.status}</span><h3>{ticket.subject}</h3><p className="muted small">{ticket.message}</p><span className="form-hint">Account {ticket.user_id.slice(0, 8)} · {ticket.order_id ? "Order " + ticket.order_id.slice(0, 8) : "No order attached"}</span><form action={updateSupportCaseStatusAction} className="admin-action-row"><input type="hidden" name="case_id" value={ticket.id} /><button className="button button-secondary button-small" name="status" value="in_progress" type="submit">In progress</button><button className="button button-primary button-small" name="status" value="resolved" type="submit">Resolve</button><button className="button button-secondary button-small" name="status" value="closed" type="submit">Close</button></form></article>)}</div> : <p className="muted small">There are no open support cases.</p>}
            </section>
            <section className="panel dashboard-section" id="orders"><div className="dashboard-section-head"><h2>Recent orders</h2><ShoppingBag size={17} color="#087f71" /></div>
              {recentOrders.data?.length ? <div className="order-list">{recentOrders.data.map((order) => { const business = Array.isArray(order.businesses) ? order.businesses[0] : order.businesses; return <article className="order-row" key={order.id}><span className="order-icon"><ShoppingBag size={16} /></span><span className="order-copy"><strong>Order {order.id.slice(0, 8)} · {business?.name ?? "Supplier"}</strong><small>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(order.created_at))} · {formatMoney(order.total_kobo, order.currency)}</small></span><span className="pill">{order.status.replaceAll("_", " ")}</span></article>; })}</div> : <p className="muted small">No order records yet.</p>}
            </section>
            <section className="panel dashboard-section" id="activity"><div className="dashboard-section-head"><h2>Recent admin activity</h2><Activity size={17} color="#087f71" /></div>
              {recentAudit.data?.length ? <div className="order-list">{recentAudit.data.map((entry) => { const profile = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles; return <article className="order-row" key={entry.id}><span className="order-icon"><ShieldCheck size={16} /></span><span className="order-copy"><strong>{entry.action.replaceAll("_", " ")}</strong><small>{profile?.full_name || "Administrator"} · {entry.target_type}{entry.target_id ? " · " + entry.target_id.slice(0, 8) : ""}</small></span><small className="muted">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.created_at))}</small></article>; })}</div> : <p className="muted small">Recorded admin actions will appear here.</p>}
            </section>
          </div>
          <aside>
            <section className="panel dashboard-section" id="plans"><div className="dashboard-section-head"><h2>Subscription plans</h2><Settings2 size={17} color="#246bfe" /></div>
              <div className="admin-plan-list">{plans.map((plan) => <form className="admin-plan" action={adminUpdatePlanAction} key={plan.id}><input type="hidden" name="plan_id" value={plan.id} /><h3>{plan.name}</h3><div className="form-field"><label htmlFor={"plan-price-" + plan.id}>Monthly price (USD)</label><input id={"plan-price-" + plan.id} name="price" type="number" min="0" step="0.01" defaultValue={Number(plan.monthly_price_kobo) / 100} required /></div><div className="form-field"><label htmlFor={"plan-benefits-" + plan.id}>Benefits, one per line</label><textarea id={"plan-benefits-" + plan.id} name="benefits" defaultValue={plan.benefits.join("\n")} maxLength={1200} /></div><div className="form-field"><label htmlFor={"plan-active-" + plan.id}>Availability</label><select id={"plan-active-" + plan.id} name="is_active" defaultValue={plan.is_active ? "yes" : "no"}><option value="yes">Active</option><option value="no">Hidden</option></select></div><button className="button button-secondary button-small" type="submit">Save plan <ArrowRight size={13} /></button></form>)}</div>
            </section>
            <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Marketplace fee</h2><CreditCard size={17} color="#246bfe" /></div><p className="muted small">The fee is currently applied when a quotation is accepted. Payout and settlement arrangements remain outside this implementation.</p><form action={adminUpdateMarketplaceFeeAction}><div className="form-field"><label htmlFor="fee_percent">Fee percent (0–20%)</label><input id="fee_percent" name="fee_percent" type="number" min="0" max="20" step="0.01" defaultValue={(feeBps / 100).toFixed(2)} required /></div><button className="button button-secondary button-small" type="submit">Save fee</button></form></section>
            <section className="panel quick-links"><h2>Admin operations</h2><a href="#accounts"><ShieldCheck size={16} /> Account directory <ArrowRight size={14} /></a><a href="#reviews"><Building2 size={16} /> Supplier verification <ArrowRight size={14} /></a><a href="#activity"><Activity size={16} /> Audit activity <ArrowRight size={14} /></a></section>
          </aside>
        </div>
      </div>
    </section>
  );
}
