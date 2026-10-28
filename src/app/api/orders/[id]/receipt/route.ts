import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildReceiptPdf } from "@/lib/receipt-pdf";
import { formatNaira } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Sign in to download this receipt." }, { status: 401 });
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const { data: order } = await supabase.from("orders")
    .select("id,buyer_id,business_id,status,subtotal_kobo,delivery_fee_kobo,platform_fee_kobo,total_kobo,currency,created_at,paid_at,businesses(name,city),order_items(product_name,quantity,unit_price_kobo),payments!inner(provider_reference,status,verified_at)")
    .eq("id", id).eq("payments.status", "succeeded").maybeSingle();
  if (!order || !["paid", "preparing", "ready_for_pickup", "dispatched", "delivered", "completed"].includes(order.status)) {
    return NextResponse.json({ error: "A verified receipt is not available for this order." }, { status: 404 });
  }
  const business = Array.isArray(order.businesses) ? order.businesses[0] : order.businesses;
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const payment = Array.isArray(order.payments) ? order.payments[0] : order.payments;
  const canAccess = order.buyer_id === user.id || Boolean((await supabase.from("business_memberships").select("business_id").eq("business_id", order.business_id).eq("user_id", user.id).maybeSingle()).data);
  if (!canAccess || !payment) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  const lines = [
    "STOCKSOS — VERIFIED PAYMENT RECEIPT",
    `Order: ${order.id}`,
    `Payment reference: ${payment.provider_reference}`,
    `Payment date: ${payment.verified_at ?? order.paid_at ?? order.created_at}`,
    `Supplier: ${business?.name ?? "Supplier"} (${business?.city ?? "Nigeria"})`,
    "",
    "ITEMS",
    ...items.map((item: { product_name: string; quantity: number; unit_price_kobo: number }) => `${item.product_name} x${item.quantity} — ${formatNaira(item.unit_price_kobo * item.quantity)}`),
    "",
    `Subtotal: ${formatNaira(order.subtotal_kobo)}`,
    `Delivery: ${formatNaira(order.delivery_fee_kobo)}`,
    `StockSOS platform fee: ${formatNaira(order.platform_fee_kobo)}`,
    `TOTAL: ${formatNaira(order.total_kobo)}`,
    "",
    "This receipt reflects a provider-verified Paystack transaction. StockSOS does not operate an escrow wallet.",
  ];
  const pdf = buildReceiptPdf(lines);
  return new NextResponse(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="stocksos-receipt-${order.id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
