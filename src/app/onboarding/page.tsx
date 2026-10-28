import Link from "next/link";
import { ArrowRight, Building2, MapPin } from "lucide-react";
import { saveOnboardingAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function OnboardingPage({ searchParams }: Props) {
  const user = await requireUser();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase!.from("profiles").select("full_name, phone, home_city").eq("id", user.id).maybeSingle();
  return (
    <section className="auth-shell">
      <div className="form-panel">
        <div className="form-header">
          <span className="eyebrow"><Building2 size={14} /> Set up your profile</span>
          <h1>Let’s get you started</h1>
          <p>Add the basics you’ll use for requests and supplier communication. You can change them later.</p>
        </div>
        {params.error ? <div className="notice error-notice" role="alert"><div><strong>We couldn’t save those details.</strong><p>Review the fields and try again.</p></div></div> : null}
        <div className="auth-panel">
          <form action={saveOnboardingAction}>
            <div className="form-field"><label htmlFor="full_name">Your name</label><input id="full_name" name="full_name" defaultValue={data?.full_name ?? ""} required minLength={2} maxLength={120} autoComplete="name" /></div>
            <div className="form-field"><label htmlFor="phone">Business phone <span className="muted">(optional)</span></label><input id="phone" name="phone" type="tel" defaultValue={data?.phone ?? ""} autoComplete="tel" maxLength={30} /></div>
            <div className="form-field"><label htmlFor="city">Home city <span className="muted">(optional)</span></label><input id="city" name="city" defaultValue={data?.home_city ?? ""} maxLength={100} placeholder="Ibadan" /><span className="form-hint"><MapPin size={12} /> This helps prefill local requests.</span></div>
            <button className="button button-primary form-submit" type="submit">Save profile <ArrowRight size={16} /></button>
          </form>
        </div>
        <div className="form-bottom"><Link href="/become-supplier">Want to sell stock? Apply as a supplier</Link></div>
      </div>
    </section>
  );
}
