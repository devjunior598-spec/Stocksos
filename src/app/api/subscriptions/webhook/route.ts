import { NextResponse, type NextRequest } from "next/server";
import { getSubscriptionReconciliationConfig } from "@/lib/subscription-config";
import { reconcileSubscriptionPayment } from "@/lib/subscription-reconciliation";
import { verifySubscriptionWebhookSignature } from "@/lib/subscription-webhook-signature";

export async function POST(request: NextRequest) {
  const config = getSubscriptionReconciliationConfig();
  if (!config) return NextResponse.json({ error: "Subscription reconciliation is unavailable." }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > 256_000) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }
  const rawBody = new Uint8Array(await request.arrayBuffer());
  if (rawBody.byteLength > 256_000) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  const signature = verifySubscriptionWebhookSignature({
    rawBody,
    paystackSignature: request.headers.get("paystack-signature"),
    legacySignature: request.headers.get("x-paystack-signature"),
    webhookSecrets: process.env.PAYSTACK_SUBSCRIPTION_WEBHOOK_SECRET
      ? [process.env.PAYSTACK_SUBSCRIPTION_WEBHOOK_SECRET] : [],
    secretKey: config.secretKey,
  });
  if (!signature.valid) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });

  let event: unknown;
  try { event = JSON.parse(new TextDecoder().decode(rawBody)); } catch { event = null; }
  if (!event || typeof event !== "object") return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  const envelope = event as { event?: unknown; data?: { reference?: unknown } };
  if (envelope.event !== "charge.success") return NextResponse.json({ received: true });
  const reference = envelope.data?.reference;
  if (typeof reference !== "string" || !reference.startsWith("ssub-")) {
    return NextResponse.json({ received: true });
  }
  const result = await reconcileSubscriptionPayment(reference);
  if (result.state === "succeeded") return NextResponse.json({ received: true });
  if (result.state === "not_found") {
    // Paystack can deliver account-wide events unrelated to supplier plans.
    return NextResponse.json({ received: true });
  }
  console.error("Subscription webhook could not settle checkout", { state: result.state });
  return NextResponse.json({ error: "Payment reconciliation pending." }, { status: 503 });
}
