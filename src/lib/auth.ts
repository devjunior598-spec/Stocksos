import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthenticatedUser = { id: string; email: string | null };
export type MarketplaceRole = "buyer" | "supplier";
export type AccountStatus = "pending" | "approved" | "rejected" | "suspended";

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

export async function getMarketplaceRole(userId: string): Promise<MarketplaceRole | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.from("profiles").select("marketplace_role").eq("id", userId).maybeSingle();
  return data?.marketplace_role === "buyer" || data?.marketplace_role === "supplier"
    ? data.marketplace_role
    : null;
}

export async function getAccountStatus(userId: string): Promise<AccountStatus | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.from("profiles").select("account_status").eq("id", userId).maybeSingle();
  return ["pending", "approved", "rejected", "suspended"].includes(data?.account_status)
    ? data!.account_status as AccountStatus
    : null;
}

export async function getAccountHome(userId: string) {
  if (await getPlatformRole(userId) === "admin") return "/admin";
  return await getMarketplaceRole(userId) === "supplier" ? "/supplier" : "/dashboard";
}

export async function requireUser(options: { allowAdmin?: boolean; allowPending?: boolean; redirectTo?: string } = {}) {
  const user = await getAuthenticatedUser();
  if (!user) {
    const configured = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    const destination = options.redirectTo?.startsWith("/") ? options.redirectTo : "/dashboard";
    redirect(configured ? `/login?next=${encodeURIComponent(destination)}` : "/login?setup=required");
  }
  const platformRole = await getPlatformRole(user.id);
  if (platformRole !== "admin") {
    const accountStatus = await getAccountStatus(user.id);
    // A null status keeps rolling deployments compatible until the migration is applied.
    if (accountStatus && accountStatus !== "approved" && !options.allowPending) redirect("/account-status");
  }
  if (!options.allowAdmin && platformRole === "admin") redirect("/admin");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser({ allowAdmin: true, redirectTo: "/admin" });
  if (await getPlatformRole(user.id) !== "admin") {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return user;
}

export async function requireBuyer() {
  const user = await requireUser({ redirectTo: "/dashboard" });
  if (await getMarketplaceRole(user.id) !== "buyer") redirect("/supplier");
  return user;
}

export async function requireSupplier(options: { allowPending?: boolean } = {}) {
  const user = await requireUser({ redirectTo: "/supplier", allowPending: options.allowPending });
  if (await getMarketplaceRole(user.id) !== "supplier") redirect("/dashboard");
  return user;
}

export async function requireSupportStaff() {
  const user = await requireUser({ allowAdmin: true, redirectTo: "/support" });
  const role = await getPlatformRole(user.id);
  if (role !== "support" && role !== "admin") {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return user;
}
