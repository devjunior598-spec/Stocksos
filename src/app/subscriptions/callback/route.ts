import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reconcileSubscriptionPayment } from "@/lib/subscription-reconciliation";

export async function GET(request: NextRequest) {
  const destination = new URL("/pricing", request.url);
  const reference = new URL(request.url).searchParams.get("reference") ?? "";
  if (!/^[A-Za-z0-9.=-]{8,100}$/.test(reference)) {
    destination.searchParams.set("upgrade", "unverified");
    return NextResponse.redirect(destination);
  }
  const user = await getAuthenticatedUser();
  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", "/pricing");
    return NextResponse.redirect(login);
  }
  const supabase = await createSupabaseServerClient();
  const { data: checkout, error } = await supabase!.from("subscription_checkout_intents")
    .select("id")
    .eq("provider_reference", reference)
    .eq("created_by", user.id)
    .maybeSingle();
  if (error || !checkout) {
    destination.searchParams.set("upgrade", "unverified");
    return NextResponse.redirect(destination);
  }
  const result = await reconcileSubscriptionPayment(reference);
  destination.searchParams.set("upgrade", result.state === "succeeded" ? "succeeded"
    : result.state === "failed" ? "failed"
      : result.state === "pending" ? "pending" : "unverified");
  return NextResponse.redirect(destination);
}
