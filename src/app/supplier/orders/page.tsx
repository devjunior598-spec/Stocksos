import Link from "next/link";
import { ArrowLeft, PackageCheck, Truck } from "lucide-react";
import { updateSupplierOrderStatusAction } from "@/app/actions";
import { requireSupplier } from "@/lib/auth";
import { formatMoney } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SupplierOrdersPage({ searchParams }: { searchParams: Promise<{ updated?: string; error?: string }> }) {
  const user = await requireSupplier();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const membershipResult = await supabase!.from("business_memberships").select("business_id").eq("user_id", user.id);
  const businessIds = (membershipResult.data ?? []).map((item) => item.business_id);
  const ordersResult = businessIds.length ? await supabase!.from("orders").select("id,status,total_kobo,currency,created_at,business_id,quotations(delivery_available),sos_requests(product_name,quantity)").in("business_id", businessIds).order("created_at", { ascending: false }).limit(100) : { data: [] };
  const orders = (ordersResult.data ?? []) as unknown as { id: string; status: string; total_kobo: number; currency: string; created_at: string; quotations: { delivery_available: boolean } | { delivery_available: boolean }[] | null; sos_requests: { product_name: string; quantity: number } | { product_name: string; quantity: number }[] | null }[];
  return <section className="supplier-marketplace-page"><div className="page-container supplier-orders-page"><Link className="text-link marketplace-back" href="/supplier"><ArrowLeft size={15} /> Supplier workspace</Link><div className="marketplace-page-heading"><div><span className="eyebrow"><Truck size={14} /> Orders</span><h1>Keep every order moving.</h1><p className="lead">Review accepted orders, update fulfillment status, and open the full order when you need details.</p></div></div>{params.updated ? <div className="notice success-notice"><div><strong>Order updated.</strong><p>The buyer can now see the new fulfillment status.</p></div></div> : null}{params.error ? <div className="notice error-notice"><div><strong>We couldn’t update that order.</strong><p>Please refresh and try again.</p></div></div> : null}<section className="panel supplier-orders-panel">{orders.length ? <div className="order-list">{orders.map((order) => { const request = Array.isArray(order.sos_requests) ? order.sos_requests[0] : order.sos_requests; return <div className="order-row" key={order.id}><span className="order-icon"><PackageCheck size={17} /></span><span className="order-copy"><strong>{request?.product_name ?? `Order #${order.id.slice(0, 8)}`}</strong><small>{request ? `${request.quantity} requested · ` : ""}{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(order.created_at))} · {formatMoney(order.total_kobo, order.currency)}</small></span><span className="pill">{order.status.replaceAll("_", " ")}</span>{order.status === "paid" || order.status === "preparing" ? <form action={updateSupplierOrderStatusAction}><input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="status" value={order.status === "paid" ? "preparing" : "ready_for_pickup"} /><input type="hidden" name="return_to" value="/supplier/orders" /><button className="button button-secondary button-small" type="submit">{order.status === "paid" ? "Start preparing" : "Mark ready"}</button></form> : <Link className="text-link" href={`/orders/${order.id}`}>View order</Link>}</div>; })}</div> : <div className="marketplace-empty"><PackageCheck size={26} /><h2>No orders yet</h2><p>Accepted buyer quotations will appear here for fulfillment.</p></div>}</section></div></section>;
}
