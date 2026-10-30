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
  const extended = await supabase!.from("profiles").select("full_name, phone, home_city, home_country, home_region, home_postal_code, home_area, home_address, default_delivery_method").eq("id", user.id).maybeSingle();
  const { data } = extended.error
    ? await supabase!.from("profiles").select("full_name, phone, home_city").eq("id", user.id).maybeSingle()
    : extended;
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
            <div className="form-section-heading"><span>Default sourcing location</span><small>Used to speed up SOS requests. You can edit it anytime.</small></div>
            <div className="form-grid">
              <div className="form-field"><label htmlFor="country">Country</label><select id="country" name="country" defaultValue={(data as { home_country?: string } | null)?.home_country ?? "NG"}><option value="NG">Nigeria</option><option value="GH">Ghana</option><option value="KE">Kenya</option><option value="ZA">South Africa</option><option value="GB">United Kingdom</option><option value="US">United States</option></select></div>
              <div className="form-field"><label htmlFor="region">State / region</label><input id="region" name="region" defaultValue={(data as { home_region?: string } | null)?.home_region ?? ""} maxLength={100} placeholder="Lagos" autoComplete="address-level1" /></div>
            </div>
            <div className="form-grid">
              <div className="form-field"><label htmlFor="city">City</label><input id="city" name="city" defaultValue={data?.home_city ?? ""} maxLength={100} placeholder="Lagos" autoComplete="address-level2" /></div>
              <div className="form-field"><label htmlFor="postal_code">Postal code <span className="muted">(optional)</span></label><input id="postal_code" name="postal_code" defaultValue={(data as { home_postal_code?: string } | null)?.home_postal_code ?? ""} maxLength={20} placeholder="Postal code" autoComplete="postal-code" /></div>
            </div>
            <div className="form-grid">
              <div className="form-field"><label htmlFor="area">Area / neighbourhood <span className="muted">(optional)</span></label><input id="area" name="area" defaultValue={(data as { home_area?: string } | null)?.home_area ?? ""} maxLength={100} placeholder="District or neighbourhood" autoComplete="address-level3" /></div>
              <div className="form-field"><label htmlFor="address">Delivery address <span className="muted">(optional)</span></label><input id="address" name="address" defaultValue={(data as { home_address?: string } | null)?.home_address ?? ""} maxLength={240} placeholder="Street, building or landmark" autoComplete="street-address" /></div>
            </div>
            <div className="form-field"><label htmlFor="default_delivery_method">Default fulfilment preference</label><select id="default_delivery_method" name="default_delivery_method" defaultValue={(data as { default_delivery_method?: string } | null)?.default_delivery_method ?? "flexible"}><option value="flexible">I’m flexible</option><option value="delivery">I need delivery</option><option value="pickup">I can pick up</option></select><span className="form-hint"><MapPin size={12} /> Your saved location stays private to your account and helps prefill SOS requests.</span></div>
            <button className="button button-primary form-submit" type="submit">Save profile <ArrowRight size={16} /></button>
          </form>
        </div>
        <div className="form-bottom"><Link href="/become-supplier">Want to sell stock? Apply as a supplier</Link></div>
      </div>
    </section>
  );
}
