import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSubscriptionReconciliationConfig } from "@/lib/subscription-config";
import { reconcileSubscriptionPayment } from "@/lib/subscription-reconciliation";

export const maxDuration = 60;

function authorized(header: string | null, secret: string) {
  const supplied = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return suppliedBytes.length === expectedBytes.length
    && timingSafeEqual(suppliedBytes, expectedBytes);
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authorized(request.headers.get("authorization"), cronSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!getSubscriptionReconciliationConfig()) return NextResponse.json({ checked: 0 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Billing database is unavailable." }, { status: 503 });
  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
  const earliest = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
  const { data, error } = await admin.from("subscription_checkout_intents")
    .select("provider_reference")
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .gte("created_at", earliest)
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) return NextResponse.json({ error: "Pending upgrades could not be loaded." }, { status: 503 });
  let verified = 0;
  let unresolved = 0;
  const intents = data ?? [];
  for (let offset = 0; offset < intents.length; offset += 5) {
    const results = await Promise.all(intents.slice(offset, offset + 5)
      .map((intent) => reconcileSubscriptionPayment(intent.provider_reference)));
    for (const result of results) {
      if (result.state === "succeeded") verified += 1;
      else if (result.state === "unavailable" || result.state === "disabled") unresolved += 1;
    }
  }
  return NextResponse.json({ checked: data?.length ?? 0, verified, unresolved });
}
