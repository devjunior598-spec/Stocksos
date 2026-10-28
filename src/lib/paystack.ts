import "server-only";

export type PaystackVerification = {
  status: boolean;
  message?: string;
  data?: {
    id?: number | string;
    status?: string;
    reference?: string;
    amount?: number;
    currency?: string;
  };
};

export async function verifyPaystackTransaction(reference: string, secretKey: string) {
  if (!/^[a-zA-Z0-9.=-]{8,100}$/.test(reference)) return null;
  const response = await fetch("https://api.paystack.co/transaction/verify/" + encodeURIComponent(reference), {
    method: "GET",
    headers: { Authorization: "Bearer " + secretKey, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  }).catch(() => null);
  if (!response?.ok) return null;
  return await response.json() as PaystackVerification;
}

export async function verifyAndRecordPaystackPayment(reference: string) {
  if (process.env.PAYMENTS_ENABLED !== "true") return { state: "disabled" as const };
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) return { state: "disabled" as const };
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = createSupabaseAdminClient();
  if (!admin) return { state: "disabled" as const };

  const { data: payment, error } = await admin.from("payments")
    .select("id,order_id,amount_kobo,currency,status,provider_transaction_id")
    .eq("provider_reference", reference).maybeSingle();
  if (error || !payment) return { state: "not_found" as const };
  if (payment.status === "succeeded") return { state: "succeeded" as const, orderId: payment.order_id };
  if (payment.status === "failed") return { state: "failed" as const, orderId: payment.order_id };
  if (payment.status !== "pending") return { state: "not_pending" as const, orderId: payment.order_id };

  const verification = await verifyPaystackTransaction(reference, secretKey);
  const transaction = verification?.data;
  if (!verification?.status || !transaction || transaction.reference !== reference) {
    return { state: "pending" as const, orderId: payment.order_id };
  }
  if (transaction.status === "failed" || transaction.status === "abandoned") {
    const { error: failError } = await admin.rpc("fail_paystack_payment", {
      p_reference: reference,
      p_provider_status: transaction.status,
    });
    if (failError) return { state: "pending" as const, orderId: payment.order_id };
    return { state: "failed" as const, orderId: payment.order_id };
  }
  if (transaction.status !== "success"
    || Number(transaction.amount) !== Number(payment.amount_kobo)
    || transaction.currency !== payment.currency
    || transaction.id === undefined) {
    return { state: "pending" as const, orderId: payment.order_id };
  }
  const { error: confirmError } = await admin.rpc("confirm_paystack_payment", {
    p_reference: reference,
    p_transaction_id: String(transaction.id),
  });
  if (confirmError) return { state: "pending" as const, orderId: payment.order_id };
  return { state: "succeeded" as const, orderId: payment.order_id };
}
