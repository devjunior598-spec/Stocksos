import Link from "next/link";
import { ArrowRight, Building2, CircleHelp, KeyRound, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { saveOnboardingAction } from "@/app/actions";
import { getMarketplaceRole, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GlobalLocationFields } from "@/components/global-location-fields";
import { PhoneLoginSetup } from "@/components/phone-login-setup";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function OnboardingPage({ searchParams }: Props) {
  const user = await requireUser();
  const marketplaceRole = await getMarketplaceRole(user.id);
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const extended = await supabase!.from("profiles").select("full_name, phone, home_city, home_country, home_region, home_postal_code, home_area, home_address, default_delivery_method, account_status").eq("id", user.id).maybeSingle();
  const { data } = extended.error
    ? await supabase!.from("profiles").select("full_name, phone, home_city").eq("id", user.id).maybeSingle()
    : extended;
  const profile = (data ?? {}) as {
    full_name?: string | null;
    phone?: string | null;
    home_city?: string | null;
    home_country?: string | null;
    home_region?: string | null;
    home_postal_code?: string | null;
    home_area?: string | null;
    home_address?: string | null;
    default_delivery_method?: string | null;
    account_status?: string | null;
  };
  const profileIsReady = Boolean(profile.full_name && profile.home_country && profile.home_region && profile.home_city);
  const accountStatus = profile.account_status;
  const accountStatusLabel = accountStatus === "approved" ? "Approved"
    : accountStatus === "pending" ? "Under review"
      : accountStatus === "rejected" ? "Action needed"
        : accountStatus === "suspended" ? "Restricted"
          : "Status unavailable";
  const locationSummary = [profile.home_city, profile.home_region, profile.home_country].filter(Boolean).join(", ") || "Add your sourcing location";
  const deliveryPreference = profile.default_delivery_method === "pickup" ? "Pickup"
    : profile.default_delivery_method === "delivery" ? "Delivery"
      : profile.default_delivery_method === "flexible" ? "No preference"
        : "Pickup or delivery";
  const workspace = marketplaceRole === "supplier"
    ? { href: "/supplier", label: "Supplier Workspace" }
    : { href: "/dashboard", label: "Buyer dashboard" };
  return (
    <section className="dashboard-shell">
      <div className="page-container">
        <div className="dashboard-top account-settings-heading">
          <div>
            <span className="eyebrow"><UserRound size={14} /> {profileIsReady ? "My account" : "Account setup"}</span>
            <h1>{profileIsReady ? "Account Settings" : "Let’s get you started"}</h1>
            <p>{marketplaceRole === "supplier" ? "Manage the contact and location details used across your supplier workspace." : "Manage your sourcing, contact and fulfilment details in one place."}</p>
          </div>
          <Link className="button button-secondary" href={workspace.href}>{workspace.label} <ArrowRight size={15} /></Link>
        </div>
        {params.error ? <div className="notice error-notice account-settings-error" role="alert"><div><strong>We couldn’t save those details.</strong><p>Review the fields and try again.</p></div></div> : null}
        <div className="dashboard-columns account-settings-columns">
          <section className="panel dashboard-section account-profile-panel">
            <div className="dashboard-section-head"><div><h2>Profile and fulfilment</h2><p className="muted small">Changes are saved securely to your StockSOS account.</p></div><Building2 size={18} color="#246bfe" /></div>
          <form action={saveOnboardingAction}>
            <div className="form-field"><label htmlFor="full_name">Your name</label><input id="full_name" name="full_name" defaultValue={data?.full_name ?? ""} required minLength={2} maxLength={120} autoComplete="name" /></div>
            <div className="form-field"><label htmlFor="phone">Mobile / business phone</label><input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={data?.phone ?? user.signupPhone ?? ""} autoComplete="tel" maxLength={30} placeholder="Include country code, e.g. +14155552671" /><span className="form-hint">This is your contact number and the number you can verify for SMS sign-in.</span></div>
            <GlobalLocationFields description={marketplaceRole === "supplier" ? "Saved securely as your default business location." : "Saved securely to speed up future sourcing and fulfilment."} defaults={{
              country: profile.home_country,
              region: profile.home_region,
              city: profile.home_city,
              postalCode: profile.home_postal_code,
              area: profile.home_area,
              address: profile.home_address,
            }} />
            <div className="form-field"><label htmlFor="default_delivery_method">Default fulfilment preference</label><select id="default_delivery_method" name="default_delivery_method" defaultValue={profile.default_delivery_method ?? "both"}><option value="both">Both: pickup or delivery</option><option value="delivery">Delivery to me</option><option value="pickup">I can pick it up</option><option value="flexible">No preference</option></select><span className="form-hint"><MapPin size={12} /> “Both” lets you choose pickup or delivery for each request. “No preference” lets the supplier recommend.</span></div>
            <button className="button button-primary form-submit" type="submit">Save profile <ArrowRight size={16} /></button>
          </form>
          </section>
          <aside className="account-settings-aside">
            <section className="panel dashboard-section account-summary-panel">
              <div className="dashboard-section-head"><div><h2>Account overview</h2><p className="muted small">Your StockSOS sign-in and profile status.</p></div><ShieldCheck size={18} color="#246bfe" /></div>
              <dl className="account-summary-list">
                <div><dt>Sign-in email</dt><dd>{user.email ?? "Unavailable"}</dd></div>
                <div><dt>Phone sign-in</dt><dd>{user.verifiedPhone ? "Verified" : "Not verified"}</dd></div>
                <div><dt>Account type</dt><dd>{marketplaceRole === "supplier" ? "Supplier" : "Buyer"}</dd></div>
                <div><dt>Account review</dt><dd><span className={`account-status-pill ${accountStatus ?? "unknown"}`}>{accountStatusLabel}</span></dd></div>
                <div><dt>Default location</dt><dd>{locationSummary}</dd></div>
                <div><dt>Fulfilment preference</dt><dd>{deliveryPreference}</dd></div>
              </dl>
            </section>
            <section className="panel dashboard-section account-security-panel">
              <PhoneLoginSetup initialPhone={profile.phone ?? user.signupPhone ?? ""} verifiedPhone={user.verifiedPhone} />
            </section>
            <section className="panel dashboard-section account-security-panel">
              <div className="dashboard-section-head"><div><h2>Security and help</h2><p className="muted small">Keep your account accessible and protected.</p></div><KeyRound size={18} color="#246bfe" /></div>
              <Link className="account-settings-link" href="/forgot-password"><span><strong>Change password</strong><small>Send a secure reset link to your email.</small></span><ArrowRight size={15} /></Link>
              <Link className="account-settings-link" href="/contact"><span><strong>Contact StockSOS support</strong><small>Get help with your account.</small></span><CircleHelp size={15} /></Link>
              <p className="form-hint account-settings-hint">Your home address is kept with your profile and used to prefill sourcing and fulfilment details.</p>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}
