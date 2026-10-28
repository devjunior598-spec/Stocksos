import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { requestPasswordResetAction } from "@/app/actions";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";

type Props = { searchParams: Promise<{ error?: string; setup?: string; sent?: string }> };

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <section className="auth-shell">
      <div className="form-panel">
        <div className="form-header">
          <span className="eyebrow"><Mail size={14} /> Password recovery</span>
          <h1>Reset your password</h1>
          <p>Enter your account email and we’ll send a secure reset link if it matches an account.</p>
        </div>
        <SupabaseSetupNotice />
        {params.sent ? <div className="notice success-notice" role="status"><div><strong>Check your inbox.</strong><p>If the address is registered, a password reset link is on its way.</p></div></div> : null}
        {params.error ? <div className="notice error-notice" role="alert"><div><strong>Enter a valid email address.</strong></div></div> : null}
        <div className="auth-panel">
          <form action={requestPasswordResetAction}>
            <div className="form-field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
            <button className="button button-primary form-submit" type="submit">Send reset link <ArrowRight size={16} /></button>
          </form>
          <div className="form-bottom"><Link href="/login">Back to log in</Link></div>
        </div>
      </div>
    </section>
  );
}
