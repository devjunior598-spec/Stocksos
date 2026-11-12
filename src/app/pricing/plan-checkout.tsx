"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, CreditCard, Landmark, LockKeyhole } from "lucide-react";
import type { ReferenceRates } from "@/lib/pricing-localization";
import { estimateLocalMinor } from "@/lib/local-currency-estimate";
import styles from "./pricing.module.css";

export type Plan = {
  id: string;
  name: string;
  monthlyPriceUsdMinor: number;
  benefits: string[];
};

export type PlanPrice = {
  plan_id: string;
  currency: "NGN" | "USD";
  amount_minor: number;
  is_active: boolean;
};

export type SupplierBusiness = {
  id: string;
  name: string;
  country: string;
};

type Props = {
  plans: Plan[];
  prices: PlanPrice[];
  countries: { code: string; name: string; currency: string }[];
  suggestedCountry: string;
  referenceRates: ReferenceRates;
  businesses: SupplierBusiness[];
  isSignedIn: boolean;
  isSupplier: boolean;
  checkoutConfigured: boolean;
  usdCardEnabled: boolean;
  checkoutPlanId?: string;
};

function money(amountMinor: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

function localEstimate(amountMinor: number, chargedCurrency: "NGN" | "USD", displayCurrency: string, rates: ReferenceRates) {
  const convertedMinor = estimateLocalMinor(amountMinor, chargedCurrency, displayCurrency, rates.perUsd);
  if (convertedMinor === null) return null;
  return { label: money(convertedMinor, displayCurrency), approximate: chargedCurrency !== displayCurrency };
}

export function PlanCheckout({ plans, prices, countries, suggestedCountry, referenceRates, businesses, isSignedIn, isSupplier, checkoutConfigured, usdCardEnabled, checkoutPlanId }: Props) {
  const selectedPlanId = checkoutPlanId ?? "";
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const [previewCountry, setPreviewCountry] = useState(suggestedCountry);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank_transfer">("card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedBusiness = businesses.find((business) => business.id === businessId);
  const billingCountry = selectedBusiness?.country || previewCountry;
  const displayCurrency = countries.find((country) => country.code === previewCountry)?.currency || "USD";
  const countryName = countries.find((country) => country.code === billingCountry)?.name ?? billingCountry;
  const currency = billingCountry === "NG" ? "NGN" : "USD";
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId && plan.id !== "free");
  const selectedPrice = prices.find((price) => price.plan_id === selectedPlanId && price.currency === currency);
  const method = billingCountry === "NG" ? paymentMethod : "card";

  let setupMessage = "";
  if (!checkoutConfigured) setupMessage = "Online plan upgrades are not open yet. Your current access is unchanged.";
  else if (!isSignedIn) setupMessage = "Sign in as a supplier to upgrade a business.";
  else if (!isSupplier) setupMessage = "Plan upgrades are available to approved supplier accounts.";
  else if (!businesses.length) setupMessage = "Set up and approve a supplier business before upgrading.";
  else if (!selectedBusiness) setupMessage = "Select the supplier business to upgrade.";
  else if (!billingCountry) setupMessage = "Add your business country before upgrading.";
  else if (!selectedPrice) setupMessage = billingCountry === "NG"
    ? "The NGN price is not set yet, so Nigerian checkout is unavailable."
    : "A price is not available for this billing country yet.";
  else if (currency === "USD" && !usdCardEnabled) setupMessage = "International card billing is awaiting provider approval.";

  async function startCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (setupMessage || !selectedPlan || !selectedBusiness || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/subscriptions/initialize", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlan.id,
          businessId: selectedBusiness.id,
          billingCountry,
          paymentMethod: method,
        }),
      });
      const result = await response.json() as { authorizationUrl?: unknown; error?: unknown };
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Checkout could not be started. Please try again.");
      if (typeof result.authorizationUrl !== "string") throw new Error("A secure payment page was not returned. Please try again.");
      const destination = new URL(result.authorizationUrl);
      if (destination.protocol !== "https:" || destination.hostname !== "checkout.paystack.com") {
        throw new Error("The payment page could not be verified. Please contact support.");
      }
      window.location.assign(destination.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout could not be started. Please try again.");
      setBusy(false);
    }
  }

  return (
    <>
      {!checkoutPlanId ? <><div className={styles.localCurrencyBar}>
        <div><strong>Prices for your location</strong><p>Country is suggested from your connection. Change it if you are browsing from elsewhere. Your IP is not saved as a pricing preference.</p></div>
        <label className={styles.field}><span>Display country</span><select value={previewCountry} onChange={(event) => { setPreviewCountry(event.target.value); setError(""); }}><option value="">Choose a country</option>{countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}</select></label>
      </div>
      <div className={styles.planGrid}>
        {plans.map((plan) => {
          const paid = plan.id !== "free";
          const price = prices.find((item) => item.plan_id === plan.id && item.currency === currency);
          const referenceAmount = price?.amount_minor ?? plan.monthlyPriceUsdMinor;
          const referenceCurrency = price?.currency ?? "USD";
          const local = paid ? localEstimate(referenceAmount, referenceCurrency, displayCurrency, referenceRates) : null;
          return (
            <article className={styles.planCard} key={plan.id}>
              <div className={styles.planTop}>
                <span className={styles.planLabel}>{paid ? "For growing suppliers" : "A confident start"}</span>
              </div>
              <h2>{plan.name}</h2>
              <div className={styles.price}>
                <strong>{paid ? local ? `${local.approximate || !price ? "≈ " : ""}${local.label}` : price ? money(price.amount_minor, price.currency) : "Price pending" : "Free"}</strong>
                {paid ? <span>{local?.approximate || !price ? "local estimate" : "per prepaid month"}</span> : null}
              </div>
              {paid ? <p className={styles.billingNote}>{price ? `Checkout bills ${money(price.amount_minor, price.currency)}.` : "Final checkout price for this business country is pending."}</p> : null}
              <p className={styles.planDescription}>{paid ? "More room to grow your StockSOS business." : "Create a business profile and start listing eligible stock."}</p>
              <ul className={styles.benefits}>
                {plan.benefits.map((benefit) => <li key={benefit}><BadgeCheck size={16} aria-hidden="true" /><span>{benefit}</span></li>)}
              </ul>
              {paid ? (
                <Link className={styles.planAction} href={`/pricing/checkout/${encodeURIComponent(plan.id)}${previewCountry ? `?country=${encodeURIComponent(previewCountry)}` : ""}`}>
                  Choose {plan.name} <ArrowRight size={16} />
                </Link>
              ) : (
                <Link className={styles.planAction} href={isSupplier ? "/supplier" : "/become-supplier"}>
                  {isSupplier ? "Open workspace" : "Get started"} <ArrowRight size={16} />
                </Link>
              )}
            </article>
          );
        })}
      </div>
      <p className={styles.fxNote}>Local currency amounts marked ≈ use indicative reference rates; publication dates vary by currency. The exact charge is shown in the checkout currency before payment. <a href="https://frankfurter.dev/" target="_blank" rel="noreferrer">Reference rate source</a>.</p></> : null}

      {selectedPlan ? <><Link className={styles.backToPlans} href="/pricing"><ArrowLeft size={15} /> Back to all plans</Link><form className={styles.checkout} onSubmit={startCheckout}>
        <div className={styles.checkoutHeading}>
          <div className={styles.checkoutIcon}><LockKeyhole size={20} /></div>
          <div><span className="eyebrow">Upgrade preview</span><h2>Review your {selectedPlan.name} upgrade</h2><p>Choose the business and payment method before opening a secure Paystack checkout.</p></div>
        </div>
        <ul className={styles.checkoutBenefits}>{selectedPlan.benefits.map((benefit) => <li key={benefit}><BadgeCheck size={15} />{benefit}</li>)}</ul>

        <div className={styles.checkoutFields}>
          <label className={styles.field}>
            <span>Business to upgrade</span>
            {businesses.length ? <select value={businessId} onChange={(event) => { setBusinessId(event.target.value); setPaymentMethod("card"); setError(""); }}>
              {businesses.map((business) => <option key={business.id} value={business.id}>{business.name} · {countries.find((country) => country.code === business.country)?.name ?? business.country}</option>)}
            </select> : <div className={styles.fieldHint}><Building2 size={16} /> {isSignedIn && isSupplier ? "No approved supplier business yet" : "Sign in as a supplier to choose a business"}</div>}
          </label>
          <label className={styles.field}>
            <span>Billing country</span>
            {selectedBusiness ? <div className={styles.countryDisplay}>{countryName || "Country not set"}<small>From your approved business profile</small></div> : <div className={styles.countryDisplay}>{countryName || "Choose a display country above"}<small>Preview only. Your approved business profile determines the checkout country.</small></div>}
          </label>
        </div>

        <div className={styles.paymentArea}>
          <div><strong>Payment method</strong><p>{billingCountry === "NG" ? "Nigerian businesses may pay by card or by a temporary account generated for this payment." : "Card checkout is the available method outside Nigeria."}</p></div>
          <div className={styles.methods} role="radiogroup" aria-label="Payment method">
            <label className={`${styles.method} ${method === "card" ? styles.activeMethod : ""}`}>
              <input type="radio" name="payment-method" value="card" checked={method === "card"} onChange={() => setPaymentMethod("card")} />
              <CreditCard size={19} /><span><strong>Card</strong><small>Secure card checkout</small></span>
            </label>
            {billingCountry === "NG" ? <label className={`${styles.method} ${method === "bank_transfer" ? styles.activeMethod : ""}`}>
              <input type="radio" name="payment-method" value="bank_transfer" checked={method === "bank_transfer"} onChange={() => setPaymentMethod("bank_transfer")} />
              <Landmark size={19} /><span><strong>Bank transfer</strong><small>One-time Paystack account</small></span>
            </label> : null}
          </div>
        </div>

        <div className={styles.checkoutFooter}>
          <div className={styles.total}><span>One prepaid month · actual checkout currency</span><strong>{selectedPrice ? money(selectedPrice.amount_minor, selectedPrice.currency) : "Price unavailable"}</strong><small>Access begins only after StockSOS verifies the payment. It ends after one month unless you renew. Your bank may convert the charge to your card currency at its own rate.</small></div>
          <div className={styles.checkoutAction}>
            {setupMessage ? <p className={styles.unavailable} role="status">{setupMessage}</p> : null}
            {!isSignedIn ? <Link className="text-link" href={`/login?next=${encodeURIComponent(`/pricing/checkout/${selectedPlan.id}`)}`}>Sign in to continue <ArrowRight size={14} /></Link> : null}
            {error ? <p className={styles.checkoutError} role="alert">{error}</p> : null}
            <button className="button button-primary" type="submit" disabled={Boolean(setupMessage) || busy}>{busy ? "Opening secure checkout…" : "Continue to payment"} <ArrowRight size={16} /></button>
          </div>
        </div>
      </form></> : null}
    </>
  );
}
