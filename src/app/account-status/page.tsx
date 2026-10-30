import Link from "next/link";
import { CircleAlert, Clock3, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/actions";
import { getAccountHome, getAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountStatusPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase!.from("profiles")
    .select("full_name,platform_role,marketplace_role,account_status,account_review_note,account_reviewed_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || profile.platform_role === "admin" || profile.account_status === "approved") redirect(await getAccountHome(user.id));

  const rejected = profile.account_status === "rejected";
  const suspended = profile.account_status === "suspended";
  const Icon = suspended ? ShieldAlert : rejected ? CircleAlert : Clock3;
  const title = suspended ? "Your account is suspended" : rejected ? "Your application needs attention" : "Your account is awaiting approval";
  const message = suspended
    ? "Marketplace access is paused. Contact StockSOS support if you believe this was a mistake."
    : rejected
      ? "An administrator reviewed your application and could not approve it yet."
      : "The StockSOS team is reviewing your account. You will receive a notification when access is approved.";

  return <section className="auth-shell"><div className="page-container"><article className="auth-panel account-status-panel"><span className="feature-icon"><Icon size={22} /></span><span className="eyebrow">Account review</span><h1>{title}</h1><p className="lead">{message}</p>{profile.account_review_note ? <div className="notice"><div><strong>Administrator note</strong><p>{profile.account_review_note}</p></div></div> : null}<div className="account-status-actions"><Link className="button button-primary" href="/contact">Contact support</Link><form action={signOutAction}><button className="button button-secondary" type="submit">Log out</button></form></div></article></div></section>;
}
