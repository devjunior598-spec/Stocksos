import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { verifyAndRecordPaystackPayment } from "@/lib/paystack";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function hasValidCronSecret(header: string | null, expected: string) {
  const supplied = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !hasValidCronSecret(request.headers.get("authorization"), cronSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Database service credentials are not configured." }, { status: 503 });

  const { data: expiredCount, error: expiryError } = await admin.rpc("expire_unpaid_orders", { p_limit: 100 });
  if (expiryError) return NextResponse.json({ error: "Unpaid order reconciliation failed." }, { status: 503 });
  const { data: expandedMatches, error: expansionError } = await admin.rpc("expand_open_sos_requests", { p_limit: 50 });
  if (expansionError && expansionError.code !== "42883") return NextResponse.json({ error: "SOS expansion failed." }, { status: 503 });

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (process.env.PAYMENTS_ENABLED !== "true" || !secretKey) {
    return NextResponse.json({ expiredOrders: expiredCount ?? 0, expandedMatches: expandedMatches ?? 0, paymentsChecked: 0 });
  }

  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: stalePayments, error: paymentError } = await admin.from("payments")
    .select("provider_reference")
    .eq("status", "pending")
    .not("checkout_url", "is", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(25);
  if (paymentError) return NextResponse.json({ error: "Pending payments could not be loaded." }, { status: 503 });

  let verified = 0;
  let failed = 0;
  for (const payment of stalePayments ?? []) {
    const result = await verifyAndRecordPaystackPayment(payment.provider_reference);
    if (result.state === "succeeded") verified++;
    else if (result.state === "failed") failed++;
  }
  return NextResponse.json({ expiredOrders: expiredCount ?? 0, expandedMatches: expandedMatches ?? 0, paymentsChecked: stalePayments?.length ?? 0, verified, failed });
}
