import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid order." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const { data: order } = await supabase.from("orders")
    .select("id,buyer_id,total_kobo,currency,status")
    .eq("id", parsed.data.orderId)
    .eq("buyer_id", user.id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status !== "awaiting_payment" || order.currency !== "USD" || Number(order.total_kobo) <= 0) {
    return NextResponse.json({ error: "This order is not ready for payment." }, { status: 409 });
  }

  return NextResponse.json({
    error: "Online payment is paused while StockSOS completes its secure global USD payment-provider setup.",
  }, { status: 503 });
}
