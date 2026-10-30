import { CircleCheck, Clock3, PackageCheck, ShoppingBag, XCircle } from "lucide-react";
import { formatMoney } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const orderStatuses = [
  "awaiting_payment",
  "paid",
  "preparing",
  "ready_for_pickup",
  "dispatched",
  "delivered",
  "completed",
  "cancelled",
  "refunded",
] as const;

function statusClass(status: string) {
  if (["completed", "delivered"].includes(status)) return "pill pill-green";
  if (["cancelled", "refunded"].includes(status)) return "pill pill-red";
  if (["preparing", "ready_for_pickup", "dispatched"].includes(status)) return "pill pill-orange";
  return "pill";
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const status = orderStatuses.includes(params.status as (typeof orderStatuses)[number]) ? params.status! : "all";
  const supabase = await createSupabaseServerClient();

  let ordersQuery = supabase!.from("orders")
    .select("id,status,total_kobo,currency,created_at,updated_at,businesses(name,city,country),order_items(product_name,quantity)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status !== "all") ordersQuery = ordersQuery.eq("status", status);

  const [ordersResult, allCount, activeCount, completedCount, exceptionCount] = await Promise.all([
    ordersQuery,
    supabase!.from("orders").select("id", { count: "exact", head: true }),
    supabase!.from("orders").select("id", { count: "exact", head: true }).not("status", "in", "(completed,cancelled,refunded)"),
    supabase!.from("orders").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase!.from("orders").select("id", { count: "exact", head: true }).in("status", ["cancelled", "refunded"]),
  ]);

  const orders = ordersResult.data ?? [];

  return (
    <>
      <div className="admin-page-heading">
        <div><span className="eyebrow"><ShoppingBag size={14} /> Order operations</span><h1>Monitor every marketplace order.</h1><p>See order value, supplier, items and fulfilment status in one operational queue.</p></div>
        <span className="pill">{allCount.count ?? 0} total</span>
      </div>

      <div className="dashboard-grid admin-account-stats">
        <article className="stat-card"><span>All orders</span><strong>{allCount.count ?? 0}</strong><ShoppingBag size={16} /></article>
        <article className="stat-card"><span>Active fulfilment</span><strong>{activeCount.count ?? 0}</strong><Clock3 size={16} /></article>
        <article className="stat-card"><span>Completed</span><strong>{completedCount.count ?? 0}</strong><CircleCheck size={16} /></article>
        <article className="stat-card"><span>Cancelled or refunded</span><strong>{exceptionCount.count ?? 0}</strong><XCircle size={16} /></article>
      </div>

      <section className="panel dashboard-section">
        <div className="dashboard-section-head"><h2>Order directory</h2><PackageCheck size={18} color="#087f71" /></div>
        <form className="admin-filter-bar" action="/admin/orders">
          <select name="status" defaultValue={status} aria-label="Filter orders by status">
            <option value="all">All order statuses</option>
            {orderStatuses.map((item) => <option value={item} key={item}>{item.replaceAll("_", " ")}</option>)}
          </select>
          <button className="button button-secondary button-small" type="submit">Apply filter</button>
        </form>
        {orders.length ? <div className="admin-order-list">{orders.map((order) => {
          const business = Array.isArray(order.businesses) ? order.businesses[0] : order.businesses;
          const items = Array.isArray(order.order_items) ? order.order_items : [];
          return <article className="admin-order-card" key={order.id}>
            <div className="admin-order-card-head">
              <div><span className={statusClass(order.status)}>{order.status.replaceAll("_", " ")}</span><h3>Order {order.id.slice(0, 8)}</h3><p>{business?.name ?? "Supplier"} · {[business?.city, business?.country].filter(Boolean).join(", ") || "Location unavailable"}</p></div>
              <strong>{formatMoney(order.total_kobo, order.currency)}</strong>
            </div>
            <div className="admin-order-items">{items.length ? items.map((item, index) => <span key={`${order.id}-${index}`}>{item.quantity} × {item.product_name}</span>) : <span>Order item details unavailable</span>}</div>
            <small>Placed {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.created_at))} · Last updated {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(order.updated_at))}</small>
          </article>;
        })}</div> : <div className="empty-state"><ShoppingBag className="empty-state-icon" /><h3>No orders match this filter</h3><p>Orders will appear here after a buyer accepts a quotation.</p></div>}
      </section>
    </>
  );
}
