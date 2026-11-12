import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAccountStatus, getAuthenticatedUser, getMarketplaceRole } from "@/lib/auth";
import { consumeRateLimit, getRequestIdentifier } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSubscriptionPaymentConfig } from "@/lib/subscription-config";
import { initializeSubscriptionPaystackCheckout } from "@/lib/subscription-paystack";

const requestSchema = z.object({
  businessId: z.uuid(),
  planId: z.string().regex(/^[a-z0-9-]{2,60}$/),
  billingCountry: z.string().regex(/^[A-Z]{2}$/),
  paymentMethod: z.enum(["card", "bank_transfer"]),
}).strict();

const intentSchema = z.object({
  id: z.uuid(),
  business_id: z.uuid(),
  plan_id: z.string(),
  currency: z.enum(["NGN", "USD"]),
  amount_minor: z.number().int().positive().safe(),
  billing_country: z.string().regex(/^[A-Z]{2}$/),
  payment_method: z.enum(["card", "bank_transfer"]),
  provider_reference: z.string().regex(/^[A-Za-z0-9.=-]{8,100}$/),
  expires_at: z.iso.datetime({ offset: true }),
});

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return jsonError("Request origin could not be verified.", 403);
  }
  if (Number(request.headers.get("content-length") ?? 0) > 2048) {
    return jsonError("Checkout request is too large.", 413);
  }
  const config = getSubscriptionPaymentConfig();
  if (!config) return jsonError("Online plan upgrades are not open yet.", 503);
  const user = await getAuthenticatedUser();
  if (!user) return jsonError("Sign in as a supplier to continue.", 401);
  const [role, status] = await Promise.all([
    getMarketplaceRole(user.id),
    getAccountStatus(user.id),
  ]);
  if (role !== "supplier" || status !== "approved") {
    return jsonError("An approved supplier account is required.", 403);
  }
  const limited = await consumeRateLimit({
    scope: "subscription-checkout",
    identifier: `${user.id}:${getRequestIdentifier(request.headers)}`,
    limit: 8,
    windowSeconds: 3600,
  });
  if (!limited.configured || limited.error) return jsonError("Checkout is temporarily unavailable.", 503);
  if (!limited.allowed) return jsonError("Too many checkout attempts. Please try later.", 429);

  const raw = await request.text().catch(() => "");
  if (raw.length > 2048) return jsonError("Checkout request is too large.", 413);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { body = null; }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return jsonError("Choose a valid business, plan, country, and payment method.", 400);
  const { businessId, planId, billingCountry, paymentMethod } = parsed.data;
  if (billingCountry !== "NG" && !config.usdEnabled) {
    return jsonError("International card billing is awaiting provider approval.", 503);
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return jsonError("Checkout is temporarily unavailable.", 503);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || authData.user?.id !== user.id || !authData.user.email || !authData.user.email_confirmed_at) {
    return jsonError("Confirm your account email before paying.", 403);
  }
  const { data, error } = await supabase.rpc("create_subscription_checkout_intent", {
    p_business_id: businessId,
    p_plan_id: planId,
    p_billing_country: billingCountry,
    p_payment_method: paymentMethod,
  });
  if (error) {
    console.error("Subscription checkout intent failed", { code: error.code });
    return jsonError(
      error.code === "P0002" ? "This plan does not have a price for your business country yet."
        : error.code === "42501" ? "An approved business owner or administrator must start this upgrade."
          : error.code === "22023" ? "Check the billing country on your business profile."
            : "Checkout is temporarily unavailable.",
      error.code === "P0002" || error.code === "22023" ? 409 : error.code === "42501" ? 403 : 503,
    );
  }
  const snapshot = intentSchema.safeParse(data);
  if (!snapshot.success || snapshot.data.business_id !== businessId
    || snapshot.data.plan_id !== planId || snapshot.data.billing_country !== billingCountry
    || snapshot.data.payment_method !== paymentMethod
    || snapshot.data.currency !== (billingCountry === "NG" ? "NGN" : "USD")) {
    console.error("Subscription checkout intent returned an invalid snapshot");
    return jsonError("Checkout is temporarily unavailable.", 503);
  }

  const callbackUrl = new URL("/subscriptions/callback", request.url).toString();
  const checkout = await initializeSubscriptionPaystackCheckout({
    secretKey: config.secretKey,
    mode: config.mode,
    checkoutId: snapshot.data.id,
    email: authData.user.email,
    callbackUrl,
    reference: snapshot.data.provider_reference,
    amountMinor: snapshot.data.amount_minor,
    currency: snapshot.data.currency,
    method: snapshot.data.payment_method,
    countryCode: snapshot.data.billing_country,
  });
  if (!checkout) {
    console.error("Paystack subscription checkout initialization failed", { checkoutId: snapshot.data.id });
    return jsonError("Secure checkout could not be opened. Please try again later.", 502);
  }
  return NextResponse.json(
    { authorizationUrl: checkout.authorizationUrl },
    { headers: { "Cache-Control": "no-store" } },
  );
}
