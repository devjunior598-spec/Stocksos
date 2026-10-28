import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedTypes: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  if (!tokenHash || !type || !allowedTypes.includes(type)) {
    return NextResponse.redirect(new URL("/auth/error", url.origin));
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.redirect(new URL("/login?setup=required", url.origin));
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) return NextResponse.redirect(new URL("/auth/error", url.origin));
  const destination = type === "recovery" ? "/reset-password" : safeNext(url.searchParams.get("next"));
  return NextResponse.redirect(new URL(destination, url.origin));
}
