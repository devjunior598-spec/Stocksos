import Link from "next/link";
import { ArrowRight, Building2, MapPin } from "lucide-react";
import { saveOnboardingAction } from "@/app/actions";
import { getMarketplaceRole, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GlobalLocationFields } from "@/components/global-location-fields";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function OnboardingPage({ searchParams }: Props) {
  const user = await requireUser();
  const marketplaceRole = await getMarketplaceRole(user.id);
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
          <p>{marketplaceRole === "supplier" ? "Add the contact and location details used for your supplier workspace. You can change them later." : "Add the basics used for sourcing requests and supplier communication. You can change them later."}</p>
        </div>
        {params.error ? <div className="notice error-notice" role="alert"><div><strong>We couldn’t save those details.</strong><p>Review the fields and try again.</p></div></div> : null}
        <div className="auth-panel">
          <form action={saveOnboardingAction}>
            <div className="form-field"><label htmlFor="full_name">Your name</label><input id="full_name" name="full_name" defaultValue={data?.full_name ?? ""} required minLength={2} maxLength={120} autoComplete="name" /></div>
            <div className="form-field"><label htmlFor="phone">Business phone <span className="muted">(optional)</span></label><input id="phone" name="phone" type="tel" defaultValue={data?.phone ?? ""} autoComplete="tel" maxLength={30} /></div>
            <GlobalLocationFields description={marketplaceRole === "supplier" ? "Saved securely as your default business location." : "Saved securely to speed up future sourcing and fulfilment."} defaults={{
              country: (data as { home_country?: string } | null)?.home_country ?? "US",
              region: (data as { home_region?: string } | null)?.home_region,
              city: data?.home_city,
              postalCode: (data as { home_postal_code?: string } | null)?.home_postal_code,
              area: (data as { home_area?: string } | null)?.home_area,
              address: (data as { home_address?: string } | null)?.home_address,
            }} />
            <div className="form-field"><label htmlFor="default_delivery_method">Default fulfilment preference</label><select id="default_delivery_method" name="default_delivery_method" defaultValue={(data as { default_delivery_method?: string } | null)?.default_delivery_method ?? "flexible"}><option value="flexible">I’m flexible</option><option value="delivery">I need delivery</option><option value="pickup">I can pick up</option></select><span className="form-hint"><MapPin size={12} /> Your saved location stays private to your account and helps prefill SOS requests.</span></div>
            <button className="button button-primary form-submit" type="submit">Save profile <ArrowRight size={16} /></button>
          </form>
        </div>
        <div className="form-bottom"><Link href="/pricing">Review StockSOS plans</Link></div>
      </div>
    </section>
  );
}
