import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const requestSchema = z.object({ orderId: z.uuid() });

export async function POST(request: NextRequest) {
  const appOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  let requestOrigin: string | null = null;
  try { requestOrigin = origin ? new URL(origin).origin : null; } catch { requestOrigin = null; }
  if (!requestOrigin || requestOrigin !== appOrigin) {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  const user = await getAuthenticatedUser();
  if (!user?.email) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid order." }, { status: 400 });

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (process.env.PAYMENTS_ENABLED !== "true" || !secretKey || !supabase || !admin) {
    return NextResponse.json({ error: "Online payment is not configured for this platform." }, { status: 503 });
  }

  const { data: order, error: orderError } = await supabase.from("orders")
    .select("id,buyer_id,total_kobo,currency,status")
    .eq("id", parsed.data.orderId)
    .eq("buyer_id", user.id)
    .single();
  if (orderError || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status !== "awaiting_payment" || order.currency !== "NGN" || Number(order.total_kobo) <= 0) {
    return NextResponse.json({ error: "This order is not ready for payment." }, { status: 409 });
  }

  let { data: payment } = await admin.from("payments")
    .select("id,provider_reference,amount_kobo,status,checkout_url")
    .eq("order_id", order.id).eq("status", "pending").maybeSingle();

  if (payment && Number(payment.amount_kobo) !== Number(order.total_kobo)) {
    return NextResponse.json({ error: "The saved payment amount does not match this order." }, { status: 409 });
  }
  if (payment?.checkout_url) return NextResponse.json({ checkoutUrl: payment.checkout_url });

  if (!payment) {
    const reference = "stk-" + randomUUID();
    const { data, error } = await admin.from("payments").insert({
      order_id: order.id,
      buyer_id: user.id,
      provider_reference: reference,
      amount_kobo: order.total_kobo,
      currency: "NGN",
      status: "pending",
    }).select("id,provider_reference,amount_kobo,status,checkout_url").single();
    if (error || !data) {
      const concurrent = await admin.from("payments").select("id,provider_reference,amount_kobo,status,checkout_url")
        .eq("order_id", order.id).eq("status", "pending").maybeSingle();
      if (!concurrent.data) return NextResponse.json({ error: "Payment could not be prepared. Try again." }, { status: 409 });
      payment = concurrent.data;
    } else {
      payment = data;
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? appOrigin;
  const callbackUrl = new URL("/payments/callback", baseUrl).toString();
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + secretKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email: user.email,
      amount: String(order.total_kobo),
      currency: "NGN",
      reference: payment.provider_reference,
      callback_url: callbackUrl,
      metadata: { order_id: order.id },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  }).catch(() => null);

  const providerResult = response?.ok
    ? await response.json().catch(() => null) as { status?: boolean; data?: { authorization_url?: string; reference?: string } } | null
    : null;
  const checkoutUrl = providerResult?.data?.authorization_url;
  let safeUrl: URL | null = null;
  try {
    safeUrl = checkoutUrl ? new URL(checkoutUrl) : null;
  } catch {
    safeUrl = null;
  }
  if (!providerResult?.status || !safeUrl || safeUrl.protocol !== "https:" || safeUrl.hostname !== "checkout.paystack.com"
    || providerResult.data?.reference !== payment.provider_reference) {
    return NextResponse.json({ error: "Payment checkout could not be initialized. Please retry shortly." }, { status: 502 });
  }

  const { error: updateError } = await admin.from("payments").update({
    checkout_url: safeUrl.toString(),
    updated_at: new Date().toISOString(),
  }).eq("id", payment.id).eq("status", "pending");
  if (updateError) return NextResponse.json({ error: "Payment checkout could not be saved." }, { status: 502 });
  return NextResponse.json({ checkoutUrl: safeUrl.toString() });
}
