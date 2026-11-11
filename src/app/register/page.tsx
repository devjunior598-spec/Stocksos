import Link from "next/link";
import { UserRoundPlus } from "lucide-react";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { AuthStory } from "@/components/auth-story";
import { RegisterForm } from "@/components/register-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ error?: string; setup?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const categoriesResult = supabase ? await supabase.from("categories")
    .select("id,name").eq("is_active", true).order("sort_order") : null;
  const categories = categoriesResult?.data ?? [];
  return (
    <section className="auth-shell">
      <div className="auth-layout">
        <AuthStory mode="register" />
        <div className="form-panel">
        <div className="form-header">
          <span className="eyebrow"><UserRoundPlus size={14} /> Create your account</span>
          <h1>Join StockSOS, step by step</h1>
          <p>Set up your account in a few focused steps. We’ll ask for the details that match the way you use the marketplace.</p>
        </div>
        <SupabaseSetupNotice />
        {params.error ? <div className="notice error-notice" role="alert"><div><strong>{params.error === "duplicate" ? "This email is already registered." : params.error === "disposable" ? "Please use a permanent email address." : params.error === "rate" ? "Too many registration attempts." : params.error === "security" ? "Registration is temporarily unavailable." : "We couldn’t create your account."}</strong><p>{params.error === "duplicate" ? "Log in with this email or use a different email address to create another account." : params.error === "disposable" ? "Temporary email addresses can’t be used to register. Use an address you can access again, or contact support if you believe this is a mistake." : params.error === "rate" ? "Please wait before trying to create another account." : params.error === "security" ? "We could not complete a security check. Please try again shortly." : "Check the details and try again."}</p></div></div> : null}
        <div className="auth-panel">
          <RegisterForm categories={categories} categoriesAvailable={!categoriesResult?.error && categories.length > 0} />
          <div className="form-bottom">Already have an account? <Link href="/login">Log in</Link></div>
        </div>
        <p className="form-bottom">By continuing, you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
        </div>
      </div>
    </section>
  );
}
