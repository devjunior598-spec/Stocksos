import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSubscriptionReconciliationConfig } from "@/lib/subscription-config";
import { verifySubscriptionPaystackCheckout } from "@/lib/subscription-paystack";

const REFERENCE_PATTERN = /^[A-Za-z0-9.=-]{8,100}$/;

export type SubscriptionReconciliationResult =
  | { state: "succeeded" | "pending" | "failed" | "invalid"; businessId: string }
  | { state: "disabled" | "not_found" | "unavailable" };

/** Provider verification is mandatory; neither callbacks nor webhooks grant access themselves. */
export async function reconcileSubscriptionPayment(reference: string): Promise<SubscriptionReconciliationResult> {
  if (!REFERENCE_PATTERN.test(reference)) return { state: "not_found" };
  const config = getSubscriptionReconciliationConfig();
  const admin = createSupabaseAdminClient();
  if (!config || !admin) return { state: "disabled" };
  const { data: checkout, error } = await admin.from("subscription_checkout_intents")
    .select("id,business_id,provider_reference,status,currency,amount_minor,billing_country,payment_method")
    .eq("provider_reference", reference).maybeSingle();
  if (error) {
    console.error("Subscription checkout lookup failed", { code: error.code });
    return { state: "unavailable" };
  }
  if (!checkout) return { state: "not_found" };
  if (checkout.status === "paid") return { state: "succeeded", businessId: checkout.business_id };
  if (checkout.currency !== "NGN" && checkout.currency !== "USD") {
    return { state: "invalid", businessId: checkout.business_id };
  }
  if (checkout.payment_method !== "card" && checkout.payment_method !== "bank_transfer") {
    return { state: "invalid", businessId: checkout.business_id };
  }
  const verification = await verifySubscriptionPaystackCheckout({
    secretKey: config.secretKey,
    mode: config.mode,
    reference,
    amountMinor: Number(checkout.amount_minor),
    currency: checkout.currency,
    method: checkout.payment_method,
    countryCode: checkout.billing_country,
  });
  if (verification.state === "unavailable") return { state: "unavailable" };
  if (verification.state !== "succeeded") {
    return { state: verification.state, businessId: checkout.business_id };
  }
  const { error: recordError } = await admin.rpc("confirm_subscription_payment", {
    p_reference: reference,
    p_provider_transaction_id: verification.transactionId,
    p_paid_at: verification.paidAt,
    p_amount_minor: Number(checkout.amount_minor),
    p_currency: checkout.currency,
  });
  if (recordError) {
    console.error("Subscription payment recording failed", { code: recordError.code, checkoutId: checkout.id });
    return { state: "unavailable" };
  }
  return { state: "succeeded", businessId: checkout.business_id };
}
