import { redirect } from "next/navigation";
import { ArrowRight, KeyRound } from "lucide-react";
import { updatePasswordAction } from "@/app/actions";
import { getAuthenticatedUser } from "@/lib/auth";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { PasswordInput } from "@/components/password-input";

type Props = { searchParams: Promise<{ error?: string; setup?: string }> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  if (!await getAuthenticatedUser() && !params.setup) redirect("/login?error=auth");
  return (
    <section className="auth-shell">
      <div className="form-panel">
        <div className="form-header">
          <span className="eyebrow"><KeyRound size={14} /> New password</span>
          <h1>Choose a new password</h1>
          <p>Use at least 10 characters to protect your account.</p>
        </div>
        <SupabaseSetupNotice />
        {params.error ? <div className="notice error-notice" role="alert"><div><strong>We couldn’t update your password.</strong><p>Open the latest reset link and try again.</p></div></div> : null}
        <div className="auth-panel">
          <form action={updatePasswordAction}>
            <PasswordInput autoComplete="new-password" minLength={10} label="New password" />
            <button className="button button-primary form-submit" type="submit">Update password <ArrowRight size={16} /></button>
          </form>
        </div>
      </div>
    </section>
  );
}
