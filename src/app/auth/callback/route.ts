import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/auth/error", url.origin));
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.redirect(new URL("/login?setup=required", url.origin));
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/auth/error", url.origin));
  const destination = safeNext(url.searchParams.get("next"));
  return NextResponse.redirect(new URL(destination, url.origin));
}
