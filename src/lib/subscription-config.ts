import "server-only";

import type { SubscriptionPaymentMode } from "@/lib/subscription-paystack";

export type SubscriptionPaymentConfig = {
  mode: SubscriptionPaymentMode;
  secretKey: string;
  usdEnabled: boolean;
};

/** Existing payments can still reconcile after new checkouts are paused. */
export function getSubscriptionReconciliationConfig(): SubscriptionPaymentConfig | null {
  const mode = process.env.SUBSCRIPTION_PAYMENTS_MODE;
  const secretKey = process.env.PAYSTACK_SUBSCRIPTION_SECRET_KEY;
  if ((mode !== "test" && mode !== "live") || !secretKey) return null;
  if (!secretKey.startsWith(mode === "live" ? "sk_live_" : "sk_test_")) return null;
  if (mode === "live" && process.env.VERCEL_ENV !== "production") return null;
  if (mode === "test") {
    if (process.env.VERCEL_ENV === "production") return null;
    const testRef = process.env.SUBSCRIPTION_TEST_PROJECT_REF;
    if (!/^[a-z0-9]{20}$/.test(testRef ?? "")
      || process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${testRef}.supabase.co`) return null;
  }
  return {
    mode,
    secretKey,
    usdEnabled: process.env.SUBSCRIPTION_USD_ENABLED === "true",
  };
}

/** Separate supplier plan billing from buyer order payments. Fail closed. */
export function getSubscriptionPaymentConfig(): SubscriptionPaymentConfig | null {
  if (process.env.SUBSCRIPTION_PAYMENTS_ENABLED !== "true") return null;
  const config = getSubscriptionReconciliationConfig();
  if (config?.mode === "live" && process.env.SUBSCRIPTION_LIVE_APPROVED !== "true") return null;
  return config;
}
