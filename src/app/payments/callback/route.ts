import { NextResponse, type NextRequest } from "next/server";
import { verifyAndRecordPaystackPayment } from "@/lib/paystack";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference") ?? "";
  const result = await verifyAndRecordPaystackPayment(reference);
  if ("orderId" in result && result.orderId) {
    const state = result.state === "succeeded" ? "verified" : result.state;
    return NextResponse.redirect(new URL("/orders/" + result.orderId + "?payment=" + state, url.origin));
  }
  return NextResponse.redirect(new URL("/dashboard?payment=unverified", url.origin));
}
