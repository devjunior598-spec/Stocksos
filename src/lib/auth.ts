import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthenticatedUser = { id: string; email: string | null };

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims || typeof claims.sub !== "string") return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}

export async function getPlatformRole(userId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.from("profiles").select("platform_role").eq("id", userId).maybeSingle();
  return typeof data?.platform_role === "string" ? data.platform_role : null;
}

export async function requireUser(options: { allowAdmin?: boolean } = {}) {
  const user = await getAuthenticatedUser();
  if (!user) {
    const configured = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    redirect(configured ? "/login?next=/dashboard" : "/login?setup=required");
  }
  if (!options.allowAdmin && await getPlatformRole(user.id) === "admin") redirect("/admin");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser({ allowAdmin: true });
  if (await getPlatformRole(user.id) !== "admin") {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return user;
}

export async function requireSupportStaff() {
  const user = await requireUser({ allowAdmin: true });
  const role = await getPlatformRole(user.id);
  if (role !== "support" && role !== "admin") {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return user;
}
