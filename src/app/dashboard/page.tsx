import Link from "next/link";
import { ArrowRight, Bell, Boxes, CircleAlert, Clock3, MapPin, PackageCheck, PackageSearch, Zap } from "lucide-react";
import { acceptQuotationAction, cancelSOSAction, markNotificationReadAction } from "@/app/actions";
import { requireBuyer } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/data";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { quoteTotalMinorUnits } from "@/lib/money";

export const dynamic = "force-dynamic";

function statusClass(status: string) {
  if (["completed", "paid", "delivered", "approved"].includes(status)) return "pill pill-green";
  if (["cancelled", "expired", "rejected"].includes(status)) return "pill pill-red";
  if (["awaiting_payment", "open", "matched", "preparing"].includes(status)) return "pill pill-orange";
  return "pill";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

export default async function BuyerDashboardPage() {
  const user = await requireBuyer();
  const supabase = await createSupabaseServerClient();
  const [profileResult, requestResult, orderResult, notificationResult] = await Promise.all([
    supabase!.from("profiles").select("full_name,home_city").eq("id", user.id).maybeSingle(),
    supabase!.from("sos_requests").select("id,product_name,quantity,city,area,urgency,delivery_method,status,created_at,expires_at").eq("requester_id", user.id).order("created_at", { ascending: false }).limit(20),
    supabase!.from("orders").select("id,status,total_kobo,currency,created_at,businesses(name,slug)").eq("buyer_id", user.id).order("created_at", { ascending: false }).limit(20),
    supabase!.from("notifications").select("id,kind,title,body,read_at,created_at,entity_type,entity_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
  ]);
  const profile = profileResult.data;
  const requests = requestResult.data ?? [];
  const orders = orderResult.data ?? [];
  const notifications = notificationResult.data ?? [];
  const requestIds = requests.filter((request) => ["open", "matched"].includes(request.status)).map((request) => request.id);
  const [{ data: quotes }, { data: feeResult }] = await Promise.all([
    requestIds.length
      ? supabase!.from("quotations").select("id,request_id,unit_price_kobo,quantity_offered,delivery_fee_kobo,delivery_available,preparation_minutes,currency,expires_at,businesses(name,slug)").in("request_id", requestIds).eq("status", "submitted").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase!.rpc("get_marketplace_fee_bps"),
  ]);
  const marketplaceFeeBps = Number(feeResult ?? 0);
  const quoteMap = new Map<string, typeof quotes>();
  for (const quote of quotes ?? []) quoteMap.set(quote.request_id, [...(quoteMap.get(quote.request_id) ?? []), quote]);
  const openCount = requests.filter((request) => request.status === "open").length;
  const pendingCount = orders.filter((order) => ["awaiting_payment", "paid", "preparing", "ready_for_pickup", "dispatched", "delivered"].includes(order.status)).length;
  const completedCount = orders.filter((order) => order.status === "completed").length;
  const responseCount = (quotes ?? []).length;

  return (
    <section className="dashboard-shell">
      <div className="page-container">
        <div className="dashboard-top">
          <div><span className="eyebrow"><span className="status-dot" /> Buyer workspace</span><h1>Welcome back{profile?.full_name ? ", " + profile.full_name.split(" ")[0] : ""}.</h1><p className="muted">Your requests, supplier offers and orders in one place.</p></div>
          <Link className="button button-primary" href="/sos"><Zap size={16} /> Send an SOS request</Link>
        </div>
        <SupabaseSetupNotice />
        <div className="dashboard-grid">
          <article className="stat-card"><span>Open SOS requests</span><strong>{openCount}</strong><span className="small">Your requests still receiving offers</span></article>
          <article className="stat-card"><span>Supplier responses</span><strong>{responseCount}</strong><span className="small">Unexpired quotations to review</span></article>
          <article className="stat-card"><span>Orders in progress</span><strong>{pendingCount}</strong><span className="small">Awaiting payment or fulfilment</span></article>
          <article className="stat-card"><span>Completed orders</span><strong>{completedCount}</strong><span className="small">Recorded in your order history</span></article>
        </div>
        <div className="dashboard-columns">
          <div>
            <section className="panel dashboard-section">
              <div className="dashboard-section-head"><h2>My SOS requests</h2><Link className="text-link small" href="/sos">New request <ArrowRight size={13} /></Link></div>
              {requests.length ? <div className="request-stack">{requests.map((request) => {
                const requestQuotes = quoteMap.get(request.id) ?? [];
                return <article className="request-summary" key={request.id}>
                  <div className="request-summary-head"><div><span className={statusClass(request.status)}>{request.status.replaceAll("_", " ")}</span><h3>{request.product_name}</h3><p className="muted small">{request.quantity} requested · {[request.area, request.city].filter(Boolean).join(", ")} · {dateLabel(request.created_at)}</p></div>
                    {request.status === "open" ? <form action={cancelSOSAction}><input type="hidden" name="request_id" value={request.id} /><button className="button button-danger button-small" type="submit">Cancel</button></form> : null}
                  </div>
                  {requestQuotes.length ? <div className="quote-list"><h4>{requestQuotes.length} quotation{requestQuotes.length === 1 ? "" : "s"}</h4>{requestQuotes.map((quote) => {
                    const business = Array.isArray(quote.businesses) ? quote.businesses[0] : quote.businesses;
                    const cost = quoteTotalMinorUnits({
                      unitPriceKobo: Number(quote.unit_price_kobo),
                      quantity: request.quantity,
                      deliveryFeeKobo: Number(quote.delivery_fee_kobo ?? 0),
                      pickup: request.delivery_method === "pickup" || !quote.delivery_available,
                      platformFeeBps: marketplaceFeeBps,
                    });
                    return <div className="quote-row" key={quote.id}><div><strong>{business?.name ?? "Supplier"}</strong><span className="muted small">{quote.quantity_offered} available · {quote.delivery_available ? "Delivery available" : "Pickup"}{quote.preparation_minutes ? " · about " + quote.preparation_minutes + " min" : ""}</span><span className="quote-cost-note">Items {formatMoney(cost.subtotal, quote.currency)}{cost.delivery ? ` · Delivery ${formatMoney(cost.delivery, quote.currency)}` : ""}{cost.platformFee ? ` · Platform fee ${formatMoney(cost.platformFee, quote.currency)}` : ""}</span></div><div className="quote-action"><strong>{formatMoney(cost.total, quote.currency)}</strong><form action={acceptQuotationAction}><input type="hidden" name="quotation_id" value={quote.id} /><button className="button button-primary button-small" type="submit">Choose offer</button></form></div></div>;
                  })}</div> : request.status === "open" ? <p className="request-waiting"><Clock3 size={14} /> Waiting for matching suppliers to respond.</p> : null}
                </article>;
              })}</div> : <div className="empty-state"><div className="empty-state-icon"><PackageSearch size={21} /></div><h3>No requests yet</h3><p>When your business needs stock, create an SOS request and review supplier offers here.</p><Link className="button button-primary" href="/sos">Create your first request</Link></div>}
            </section>
            <section className="panel dashboard-section">
              <div className="dashboard-section-head"><h2>Recent orders</h2><span className="muted small">{orders.length} recorded</span></div>
              {orders.length ? <div className="order-list">{orders.map((order) => {
                const business = Array.isArray(order.businesses) ? order.businesses[0] : order.businesses;
                return <Link className="order-row" href={"/orders/" + order.id} key={order.id}><span className="order-icon"><PackageCheck size={18} /></span><span className="order-copy"><strong>{business?.name ?? "Supplier order"}</strong><small>{dateLabel(order.created_at)} · {formatMoney(order.total_kobo, order.currency)}</small></span><span className={statusClass(order.status)}>{order.status.replaceAll("_", " ")}</span><ArrowRight size={15} /></Link>;
              })}</div> : <p className="muted small">Orders will appear after you accept a quotation.</p>}
            </section>
          </div>
          <aside>
            <section className="panel dashboard-section">
              <div className="dashboard-section-head"><h2>Notifications</h2><Bell size={17} color="#246bfe" /></div>
              {notifications.length ? <div className="notification-list">{notifications.map((notification) => <article className={notification.read_at ? "notification-row" : "notification-row notification-unread"} key={notification.id}><div className="notification-copy"><strong>{notification.title}</strong><p>{notification.body}</p><small>{dateLabel(notification.created_at)}</small></div>{!notification.read_at ? <form action={markNotificationReadAction}><input type="hidden" name="notification_id" value={notification.id} /><button className="text-link small" type="submit">Mark read</button></form> : null}</article>)}</div> : <div className="empty-notice"><Bell size={17} /><span>No new activity yet.</span></div>}
            </section>
            <section className="panel dashboard-section quick-links"><h2>Quick links</h2><Link href="/find-stock"><PackageSearch size={16} /> Browse available stock <ArrowRight size={14} /></Link><Link href="/suppliers"><Boxes size={16} /> Approved suppliers <ArrowRight size={14} /></Link><Link href="/saved-suppliers"><Boxes size={16} /> Saved suppliers <ArrowRight size={14} /></Link><Link href="/onboarding"><MapPin size={16} /> Update your profile <ArrowRight size={14} /></Link><Link href="/contact"><CircleAlert size={16} /> Get support <ArrowRight size={14} /></Link></section>
          </aside>
        </div>
      </div>
    </section>
  );
}
