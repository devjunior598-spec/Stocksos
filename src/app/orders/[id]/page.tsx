import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { buyerConfirmReceiptAction, updateSupplierOrderStatusAction } from "@/app/actions";
import { PayButton } from "@/components/pay-button";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatNaira } from "@/lib/data";

export const dynamic = "force-dynamic";

function pill(status: string) {
  if (["paid", "completed", "delivered"].includes(status)) return "pill pill-green";
  if (["awaiting_payment", "preparing"].includes(status)) return "pill pill-orange";
  if (["cancelled", "refunded"].includes(status)) return "pill pill-red";
  return "pill";
}

export default async function OrderDetailsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ payment?: string; received?: string; error?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase!.from("orders").select("id,request_id,quotation_id,buyer_id,business_id,status,subtotal_kobo,delivery_fee_kobo,platform_fee_kobo,total_kobo,currency,created_at,paid_at,businesses(name,city,slug),order_items(id,product_name,quantity,unit_price_kobo,product_id)").eq("id", id).maybeSingle();
  if (!order) notFound();
  const isBuyer = order.buyer_id === user.id;
  const business = Array.isArray(order.businesses) ? order.businesses[0] : order.businesses;
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const [{ data: request }, paymentResult] = await Promise.all([
    supabase!.from("sos_requests").select("product_name,quantity,city,area,delivery_method,urgency,specifications").eq("id", order.request_id).maybeSingle(),
    isBuyer ? supabase!.from("payments").select("status,provider_reference,created_at").eq("order_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const paymentReady = process.env.PAYMENTS_ENABLED === "true"
    && Boolean(process.env.PAYSTACK_SECRET_KEY && process.env.SUPABASE_SECRET_KEY);
  const payment = paymentResult.data;

  return (
    <section className="dashboard-shell">
      <div className="page-container order-page">
        <Link className="text-link small" href={isBuyer ? "/dashboard" : "/supplier"}><ArrowLeft size={14} /> Back to workspace</Link>
        <div className="dashboard-top order-heading"><div><span className="eyebrow"><PackageCheck size={14} /> Order details</span><h1>Order #{order.id.slice(0, 8)}</h1><p className="muted">Created {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.created_at))}</p></div><span className={pill(order.status)}>{order.status.replaceAll("_", " ")}</span></div>
        {query.payment === "verified" ? <div className="notice success-notice"><BadgeCheck size={17} /><div><strong>Payment verified.</strong><p>The order can now move into fulfilment.</p></div></div> : null}
        {query.payment === "pending" ? <div className="notice"><ShieldCheck size={17} /><div><strong>We’re checking the payment with Paystack.</strong><p>This page will show the order status after the provider response is verified.</p></div></div> : null}
        {query.received ? <div className="notice success-notice"><BadgeCheck size={17} /><div><strong>Receipt confirmed.</strong><p>The order is marked completed.</p></div></div> : null}
        {query.error ? <div className="notice error-notice"><div><strong>We couldn’t complete that order action.</strong><p>Refresh this page and try again.</p></div></div> : null}
        <div className="order-detail-grid">
          <div>
            <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Order summary</h2><span className="pill">NGN</span></div>
              <div className="order-merchant"><span className="feature-icon"><Building2Icon /></span><span><strong>{business?.name ?? "Supplier"}</strong><small>{business?.city ?? "Location confirmed with supplier"}</small></span></div>
              {request ? <div className="order-request"><h3>{request.product_name}</h3><p className="muted small">{request.quantity} requested · {[request.area, request.city].filter(Boolean).join(", ")} · {request.delivery_method.replaceAll("_", " ")}</p>{request.specifications ? <p className="muted small">{request.specifications}</p> : null}</div> : null}
              <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{items.map((item: { id: string; product_name: string; quantity: number; unit_price_kobo: number }) => <tr key={item.id}><td><strong>{item.product_name}</strong></td><td>{item.quantity}</td><td>{formatNaira(item.unit_price_kobo)}</td><td>{formatNaira(Number(item.unit_price_kobo) * Number(item.quantity))}</td></tr>)}</tbody></table></div>
              <div className="order-totals"><div><span>Items subtotal</span><strong>{formatNaira(order.subtotal_kobo)}</strong></div><div><span>Delivery</span><strong>{formatNaira(order.delivery_fee_kobo)}</strong></div><div><span>Platform fee</span><strong>{formatNaira(order.platform_fee_kobo)}</strong></div><div className="order-total"><span>Total</span><strong>{formatNaira(order.total_kobo)}</strong></div></div>
            </section>
            {isBuyer && order.status === "awaiting_payment" ? <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Payment</h2><ShieldCheck size={17} color="#246bfe" /></div>{payment?.status === "pending" ? <p className="muted small">A payment attempt exists. Continue with the checkout or wait for provider verification.</p> : <p className="muted small">The order is not confirmed until the server verifies Paystack’s transaction and amount.</p>}{paymentReady ? <PayButton orderId={order.id} /> : <div className="notice"><ShieldCheck size={17} /><div><strong>Online payment is not configured.</strong><p>Add the Paystack secret and Supabase server secret before enabling live checkout. No payment is simulated.</p></div></div>}</section> : null}
            {!isBuyer && (order.status === "paid" || order.status === "preparing") ? <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Update fulfilment</h2><Truck size={17} color="#246bfe" /></div><p className="muted small">Move the order to the next allowed supplier status.</p><form action={updateSupplierOrderStatusAction}><input type="hidden" name="order_id" value={order.id} /><input type="hidden" name="status" value={order.status === "paid" ? "preparing" : "ready_for_pickup"} /><button className="button button-primary" type="submit">{order.status === "paid" ? "Start preparing" : "Mark ready for pickup"}</button></form></section> : null}
            {isBuyer && ["ready_for_pickup", "delivered"].includes(order.status) ? <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Confirm receipt</h2><BadgeCheck size={17} color="#16845b" /></div><p className="muted small">Confirm only after you have received the items.</p><form action={buyerConfirmReceiptAction}><input type="hidden" name="order_id" value={order.id} /><button className="button button-primary" type="submit">Confirm received</button></form></section> : null}
          </div>
          <aside>
            <section className="panel dashboard-section"><h2>Fulfilment status</h2><div className="status-timeline"><div className={"timeline-step " + (order.status !== "awaiting_payment" ? "timeline-done" : "timeline-current")}><span /> <div><strong>Quotation accepted</strong><small>Supplier and terms selected</small></div></div><div className={"timeline-step " + (["paid", "preparing", "ready_for_pickup", "dispatched", "delivered", "completed"].includes(order.status) ? "timeline-done" : order.status === "awaiting_payment" ? "timeline-current" : "")}><span /><div><strong>Payment verified</strong><small>Provider confirmation updates the order</small></div></div><div className={"timeline-step " + (["preparing", "ready_for_pickup", "dispatched", "delivered", "completed"].includes(order.status) ? "timeline-done" : "")}><span /><div><strong>Supplier fulfilment</strong><small>Preparation and pickup or delivery arrangement</small></div></div><div className={"timeline-step " + (["completed"].includes(order.status) ? "timeline-done" : "")}><span /><div><strong>Completed</strong><small>Buyer confirms receipt</small></div></div></div></section>
            {payment ? <section className="panel dashboard-section"><h3>Latest payment attempt</h3><span className={pill(payment.status)}>{payment.status}</span><p className="form-hint">Reference: {payment.provider_reference}</p><p className="form-hint">A payment state changes only after provider verification.</p></section> : null}
            <div className="notice"><ShieldCheck size={17} /><div><strong>Keep order details private.</strong><p>Support can review this order if an item is missing, damaged or delayed.</p></div></div>
            <Link className="text-link small" href="/contact">Need help with this order? <ArrowRight size={13} /></Link>
          </aside>
        </div>
      </div>
    </section>
  );
}

function Building2Icon() {
  return <Truck size={19} />;
}
