import Link from "next/link";
import { ArrowRight, UserRoundPlus } from "lucide-react";
import { signUpAction } from "@/app/actions";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { PasswordInput } from "@/components/password-input";

type Props = { searchParams: Promise<{ error?: string; setup?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <section className="auth-shell">
      <div className="form-panel">
        <div className="form-header">
          <span className="eyebrow"><UserRoundPlus size={14} /> Create your account</span>
          <h1>Keep business moving</h1>
          <p>One StockSOS account works for buying, supplying, or both.</p>
        </div>
        <SupabaseSetupNotice />
        {params.error ? <div className="notice error-notice" role="alert"><div><strong>{params.error === "duplicate" ? "This email is already registered." : "We couldn’t create your account."}</strong><p>{params.error === "duplicate" ? "Log in with this email or use a different email address to create another account." : "Check the details and try again."}</p></div></div> : null}
        <div className="auth-panel">
          <form action={signUpAction}>
            <div className="form-field"><label htmlFor="full_name">Your name</label><input id="full_name" name="full_name" autoComplete="name" required minLength={2} maxLength={120} /></div>
            <div className="form-field"><label htmlFor="email">Work email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
            <PasswordInput autoComplete="new-password" minLength={10} /><span className="form-hint">Use at least 10 characters. We’ll email you a verification link.</span>
            <button className="button button-primary form-submit" type="submit">Create account <ArrowRight size={16} /></button>
          </form>
          <div className="form-bottom">Already have an account? <Link href="/login">Log in</Link></div>
        </div>
        <p className="form-bottom">By continuing, you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
      </div>
    </section>
  );
}
