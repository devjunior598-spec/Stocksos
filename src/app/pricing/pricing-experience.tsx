import Link from "next/link";
import { ArrowRight, CircleHelp, CreditCard, ShieldCheck } from "lucide-react";
import { Country } from "country-state-city";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPublicCatalogClient } from "@/lib/supabase/public-catalog";
import { getAuthenticatedUser, getMarketplaceRole } from "@/lib/auth";
import { getSubscriptionPaymentConfig } from "@/lib/subscription-config";
import { getReferenceRates } from "@/lib/pricing-localization";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { PlanCheckout, type Plan, type PlanPrice, type SupplierBusiness } from "./plan-checkout";
import styles from "./pricing.module.css";

export async function PricingExperience({ searchParams, checkoutPlanId }: { searchParams: Promise<{ upgrade?: string | string[]; country?: string | string[] }>; checkoutPlanId?: string }) {
  const params = await searchParams;
  const requestHeaders = await headers();
  const visitorCountry = requestHeaders.get("x-vercel-ip-country")?.toUpperCase() ?? "";
  const countryData = Country.getAllCountries();
  const requestedCountry = typeof params.country === "string" ? params.country.toUpperCase() : "";
  const suggestedCountry = countryData.some((country) => country.isoCode === requestedCountry) ? requestedCountry
    : countryData.some((country) => country.isoCode === visitorCountry) ? visitorCountry : "";
  const referenceRates = await getReferenceRates();
  const supabase = await createSupabaseServerClient();
  const catalog = supabase ?? await createPublicCatalogClient();
  const user = supabase ? await getAuthenticatedUser() : null;
  const isSupplier = user ? await getMarketplaceRole(user.id) === "supplier" : false;
  const [plansResult, pricesResult, businessesResult] = catalog
    ? await Promise.all([
        catalog.from("subscription_plans").select("id,name,monthly_price_kobo,benefits").eq("is_active", true).order("monthly_price_kobo"),
        catalog.from("subscription_plan_prices").select("plan_id,currency,amount_minor,is_active").eq("is_active", true),
        user && isSupplier && supabase
          ? supabase.from("business_memberships")
              .select("business_id,role,businesses(id,name,country,verification_status)")
              .eq("user_id", user.id)
              .in("role", ["owner", "admin"])
          : Promise.resolve({ data: [], error: null }),
      ])
    : [{ data: null, error: null }, { data: null, error: null }, { data: null, error: null }];

  const plans = (plansResult.data ?? []).map((plan): Plan => ({
    id: plan.id,
    name: plan.name,
    monthlyPriceUsdMinor: plan.monthly_price_kobo,
    benefits: Array.isArray(plan.benefits)
      ? plan.benefits.filter((benefit): benefit is string => typeof benefit === "string")
      : [],
  }));
  const prices = (pricesResult.data ?? []).filter((price): price is PlanPrice =>
    typeof price.plan_id === "string"
      && (price.currency === "NGN" || price.currency === "USD")
      && typeof price.amount_minor === "number"
      && price.is_active === true,
  );
  const businesses = (businessesResult.data ?? []).flatMap((membership): SupplierBusiness[] => {
    const business = Array.isArray(membership.businesses) ? membership.businesses[0] : membership.businesses;
    if (!business || business.verification_status !== "approved") return [];
    return [{ id: business.id, name: business.name, country: business.country }];
  });
  const checkoutConfig = getSubscriptionPaymentConfig();
  const checkoutConfigured = Boolean(checkoutConfig) && !pricesResult.error;
  if (checkoutPlanId && plans.length && !plans.some((plan) => plan.id === checkoutPlanId && plan.id !== "free")) notFound();

  return (
    <main className={styles.pricingPage}>
      <section className={styles.hero}>
        <div className="page-container">
          <span className="eyebrow">{checkoutPlanId ? "Plan checkout" : "StockSOS plans"}</span>
          <h1>{checkoutPlanId ? "Review your upgrade." : "Make every listing work harder."}</h1>
          <p>{checkoutPlanId ? "Confirm your business and payment method before opening secure checkout. Paid plans are prepaid for one month at a time." : "Start free and choose more tools when your business needs them. Paid plans are prepaid for one month at a time, with no automatic renewal."}</p>
          <div className={styles.heroNotes}>
            <span><ShieldCheck size={16} /> Payments verified before access begins</span>
            <span><CreditCard size={16} /> Card or eligible local bank transfer</span>
          </div>
        </div>
      </section>

      <section className={styles.content}>
        <div className="page-container">
          <SupabaseSetupNotice />
          {params.upgrade === "succeeded" ? <div className="notice success-notice" role="status"><strong>Payment verified.</strong><p>Your prepaid plan is recorded. Open your supplier workspace to use it.</p></div> : null}
          {params.upgrade === "pending" ? <div className="notice" role="status"><strong>Payment is still being verified.</strong><p>Bank transfers can take a little longer. Please refresh this page or contact support if it does not update.</p></div> : null}
          {params.upgrade === "failed" ? <div className="notice error-notice" role="alert"><strong>Payment was not completed.</strong><p>No plan upgrade was activated. You can try again when checkout is available.</p></div> : null}
          {params.upgrade === "unverified" ? <div className="notice error-notice" role="alert"><strong>Payment could not be confirmed here.</strong><p>If you were charged, contact support with your Paystack receipt so we can investigate. Do not pay again yet.</p></div> : null}
          {plansResult.error ? (
            <div className="notice error-notice" role="alert"><strong>Plans could not be loaded.</strong><p>Refresh the page or contact support if this continues.</p></div>
          ) : plans.length ? (
            <PlanCheckout
              plans={plans}
              prices={prices}
              countries={countryData.map(({ isoCode, name, currency }) => ({ code: isoCode, name, currency })).sort((a, b) => a.name.localeCompare(b.name))}
              suggestedCountry={suggestedCountry}
              referenceRates={referenceRates}
              businesses={businesses}
              isSignedIn={Boolean(user)}
              isSupplier={isSupplier}
              checkoutConfigured={checkoutConfigured}
              usdCardEnabled={checkoutConfig?.usdEnabled ?? false}
              checkoutPlanId={checkoutPlanId}
            />
          ) : (
            <div className="empty-state"><h2>Plans are unavailable right now</h2><p>Please check back later or contact support for help.</p><Link className="text-link" href="/contact">Contact support <ArrowRight size={15} /></Link></div>
          )}
          <div className={styles.helpLine}><CircleHelp size={17} /><span>Need help choosing a plan? <Link href="/contact">Talk to StockSOS support <ArrowRight size={14} /></Link></span></div>
        </div>
      </section>
    </main>
  );
}
