// Supplier plan checkout is intentionally separate from buyer order payments.
// The caller must store the quoted amount and reference before sending a buyer
// to Paystack, then activate access only after this verifier succeeds.

export type SubscriptionPaymentMode = "test" | "live";
export type SubscriptionPaymentMethod = "card" | "bank_transfer";
export type SubscriptionPaymentCurrency = "NGN" | "USD";

type CheckoutIdentity = {
  secretKey: string;
  mode: SubscriptionPaymentMode;
  reference: string;
  amountMinor: number;
  currency: SubscriptionPaymentCurrency;
  method: SubscriptionPaymentMethod;
  countryCode: string;
};

export type InitializeSubscriptionCheckoutInput = CheckoutIdentity & {
  email: string;
  callbackUrl: string;
  checkoutId: string;
};

export type VerifySubscriptionCheckoutInput = CheckoutIdentity;

export type SubscriptionCheckoutVerification =
  | { state: "succeeded"; transactionId: string; paidAt: string; channel: SubscriptionPaymentMethod }
  | { state: "pending" | "failed" | "invalid" | "unavailable" };

const REFERENCE_PATTERN = /^[A-Za-z0-9.=-]{8,100}$/;

export function allowedSubscriptionChannels(
  countryCode: string,
  currency: SubscriptionPaymentCurrency,
  method: SubscriptionPaymentMethod,
): [SubscriptionPaymentMethod] | null {
  if (method === "card") return ["card"];
  // Pay with Transfer is a Nigerian NGN checkout method, not an offline
  // transfer to a supplier or a recurring bank debit.
  if (method === "bank_transfer" && countryCode.toUpperCase() === "NG" && currency === "NGN") {
    return ["bank_transfer"];
  }
  return null;
}

function validIdentity(input: CheckoutIdentity) {
  const requiredKeyPrefix = input.mode === "live" ? "sk_live_" : "sk_test_";
  return input.secretKey.startsWith(requiredKeyPrefix)
    && input.secretKey.length > requiredKeyPrefix.length
    && REFERENCE_PATTERN.test(input.reference)
    && Number.isSafeInteger(input.amountMinor)
    && input.amountMinor > 0
    && /^[A-Z]{2}$/.test(input.countryCode)
    && allowedSubscriptionChannels(input.countryCode, input.currency, input.method) !== null;
}

function isPaystackCheckoutUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "checkout.paystack.com";
  } catch {
    return false;
  }
}

export async function initializeSubscriptionPaystackCheckout(
  input: InitializeSubscriptionCheckoutInput,
): Promise<{ authorizationUrl: string; reference: string } | null> {
  if (!validIdentity(input) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return null;
  if (!/^[0-9a-f-]{36}$/i.test(input.checkoutId)) return null;
  try {
    const callback = new URL(input.callbackUrl);
    if (callback.protocol !== "https:" && !(input.mode === "test" && callback.origin === "http://localhost:3000")) {
      return null;
    }
  } catch {
    return null;
  }

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: String(input.amountMinor),
      currency: input.currency,
      reference: input.reference,
      channels: allowedSubscriptionChannels(input.countryCode, input.currency, input.method),
      callback_url: input.callbackUrl,
      metadata: JSON.stringify({ checkout_id: input.checkoutId, purpose: "supplier_subscription" }),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  }).catch(() => null);
  if (!response?.ok) return null;
  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object" || !("status" in payload) || payload.status !== true
    || !("data" in payload) || !payload.data || typeof payload.data !== "object") return null;
  const data = payload.data;
  if (!("reference" in data) || data.reference !== input.reference
    || !("authorization_url" in data) || !isPaystackCheckoutUrl(data.authorization_url)) return null;
  return { authorizationUrl: data.authorization_url, reference: input.reference };
}

export async function verifySubscriptionPaystackCheckout(
  input: VerifySubscriptionCheckoutInput,
): Promise<SubscriptionCheckoutVerification> {
  if (!validIdentity(input)) return { state: "invalid" };
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(input.reference)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${input.secretKey}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    },
  ).catch(() => null);
  if (!response?.ok) return { state: "unavailable" };
  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object" || !("status" in payload) || payload.status !== true
    || !("data" in payload) || !payload.data || typeof payload.data !== "object") {
    return { state: "unavailable" };
  }
  const data = payload.data;
  if (!("reference" in data) || data.reference !== input.reference
    || !("amount" in data) || data.amount !== input.amountMinor
    || !("currency" in data) || data.currency !== input.currency
    || !("domain" in data) || data.domain !== input.mode
    || !("channel" in data) || data.channel !== input.method
    || !("status" in data) || typeof data.status !== "string") {
    return { state: "invalid" };
  }
  if (data.status === "failed" || data.status === "abandoned" || data.status === "reversed") {
    return { state: "failed" };
  }
  if (data.status !== "success") return { state: "pending" };
  if (!("id" in data) || !(typeof data.id === "string" || typeof data.id === "number")
    || !/^[0-9]+$/.test(String(data.id))
    || !("paid_at" in data) || typeof data.paid_at !== "string"
    || !Number.isFinite(Date.parse(data.paid_at))) {
    return { state: "invalid" };
  }
  return {
    state: "succeeded",
    transactionId: String(data.id),
    paidAt: data.paid_at,
    channel: input.method,
  };
}
