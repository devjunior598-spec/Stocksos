import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { signInAction } from "@/app/actions";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { PasswordInput } from "@/components/password-input";

type Props = { searchParams: Promise<{ error?: string; setup?: string; next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <section className="auth-shell">
      <div className="form-panel">
        <div className="form-header">
          <span className="eyebrow"><LockKeyhole size={14} /> Welcome back</span>
          <h1>Log in to StockSOS</h1>
          <p>Pick up where your business left off.</p>
        </div>
        <SupabaseSetupNotice />
        {params.error ? <div className="notice error-notice" role="alert"><div><strong>We couldn’t sign you in.</strong><p>Check your email and password, then try again.</p></div></div> : null}
        <div className="auth-panel">
          <form action={signInAction}>
            <input type="hidden" name="next" value={params.next ?? ""} />
            <div className="form-field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
            <PasswordInput autoComplete="current-password" />
            <div className="form-bottom" style={{ textAlign: "right", margin: "0 0 16px" }}><Link href="/forgot-password">Forgot password?</Link></div>
            <button className="button button-primary form-submit" type="submit">Log in <ArrowRight size={16} /></button>
          </form>
          <div className="form-bottom">New to StockSOS? <Link href="/register">Create an account</Link></div>
        </div>
      </div>
    </section>
  );
}
