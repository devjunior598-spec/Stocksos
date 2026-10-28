import { NextResponse, type NextRequest } from "next/server";
import { verifyAndRecordPaystackPayment } from "@/lib/paystack";
import { isValidPaystackSignature } from "@/lib/paystack-signature";

export async function POST(request: NextRequest) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (process.env.PAYMENTS_ENABLED !== "true" || !secretKey) return NextResponse.json({ error: "Payment processing is not configured." }, { status: 503 });

  const signature = request.headers.get("x-paystack-signature") ?? "";
  const rawBody = await request.text();
  if (!/^[a-f0-9]{128}$/i.test(signature)) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  if (!isValidPaystackSignature(rawBody, signature, secretKey)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(rawBody) as { event?: string; data?: { reference?: string } };
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  if (event.event !== "charge.success") return NextResponse.json({ received: true });
  const reference = event.data?.reference;
  if (!reference) return NextResponse.json({ error: "Missing payment reference." }, { status: 400 });
  const result = await verifyAndRecordPaystackPayment(reference);
  if (result.state === "disabled") return NextResponse.json({ error: "Payment reconciliation is not configured." }, { status: 503 });
  if (result.state === "pending") return NextResponse.json({ error: "Payment verification is pending." }, { status: 503 });
  return NextResponse.json({ received: true });
}
