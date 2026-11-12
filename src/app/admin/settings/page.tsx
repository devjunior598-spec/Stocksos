import { Check, CircleAlert, Percent, Settings2, ShieldCheck } from "lucide-react";
import { adminSetPlanNgnPriceAction, adminUpdateMarketplaceFeeAction, adminUpdatePlanAction } from "@/app/actions";
import { formatMoney } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; plan?: string; fee?: string }> }) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [plansResult, feeResult, ngnPricesResult] = await Promise.all([
    supabase!.from("subscription_plans").select("id,name,monthly_price_kobo,benefits,is_active,updated_at").order("monthly_price_kobo"),
    supabase!.from("platform_settings").select("value,updated_at").eq("key", "marketplace_fee_bps").maybeSingle(),
    supabase!.from("subscription_plan_prices").select("plan_id,amount_minor,is_active").eq("currency", "NGN"),
  ]);
  const feeBps = typeof feeResult.data?.value === "number" ? feeResult.data.value : Number(feeResult.data?.value ?? 0);
  const dataUnavailable = Boolean(plansResult.error || feeResult.error);

  return (
    <>
      <div className="admin-page-heading"><div><span className="eyebrow"><Settings2 size={14} /> Platform settings</span><h1>Control commercial settings.</h1><p>Manage supplier subscription plans and the platform marketplace fee from one protected workspace.</p></div><span className="pill"><ShieldCheck size={12} /> Audited changes</span></div>
      {params.error ? <div className="notice error-notice"><CircleAlert size={17} /><div><strong>The setting was not saved.</strong><p>Review the value and try again.</p></div></div> : null}
      {params.plan || params.fee ? <div className="notice success-notice"><Check size={17} /><div><strong>Settings updated.</strong><p>The change is live and recorded in the audit log.</p></div></div> : null}
      {dataUnavailable ? <div className="notice error-notice" role="alert"><CircleAlert size={17} /><div><strong>Settings could not be fully loaded.</strong><p>Refresh before editing prices or fees.</p></div></div> : null}
      {ngnPricesResult.error ? <div className="notice" role="status"><CircleAlert size={17} /><div><strong>NGN plan pricing is not set up in this environment.</strong><p>The reviewed subscription migration must be applied before a Nigerian price can be saved. Paid checkout remains off.</p></div></div> : null}

      <div className="dashboard-columns admin-settings-columns">
        <section className="panel dashboard-section">
          <div className="dashboard-section-head"><h2>Subscription plans</h2><Settings2 size={18} color="#087f71" /></div>
          <div className="admin-plan-list">{plansResult.data?.map((plan) => {
            const benefits = Array.isArray(plan.benefits) ? plan.benefits.filter((item): item is string => typeof item === "string") : [];
            const ngn = ngnPricesResult.data?.find((price) => price.plan_id === plan.id);
            return <article className="admin-plan" key={plan.id}>
              <div className="admin-plan-heading"><div><span className={`pill${plan.is_active ? " pill-green" : " pill-red"}`}>{plan.is_active ? "Active" : "Inactive"}</span><h3>{plan.name}</h3><p>{formatMoney(plan.monthly_price_kobo, "USD")} per month</p></div></div>
              <form className="form-grid" action={adminUpdatePlanAction}><input type="hidden" name="plan_id" value={plan.id} /><label className="form-field"><span>Monthly price (USD)</span><input name="price" inputMode="decimal" defaultValue={(plan.monthly_price_kobo / 100).toFixed(2)} required /></label><label className="form-field"><span>Benefits, one per line</span><textarea name="benefits" rows={5} defaultValue={benefits.join("\n")} /></label><label className="consent-line"><input type="checkbox" name="is_active" value="yes" defaultChecked={plan.is_active} /> Keep this plan available</label><button className="button button-primary button-small" type="submit">Save plan</button></form>
              {plan.id !== "free" && !ngnPricesResult.error ? <form className="form-grid" action={adminSetPlanNgnPriceAction} style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e8eee8" }}><input type="hidden" name="plan_id" value={plan.id} /><label className="form-field"><span>Monthly price (NGN)</span><input name="price" inputMode="decimal" placeholder="Set a fixed NGN amount" defaultValue={ngn ? (ngn.amount_minor / 100).toFixed(2) : ""} required /></label><p className="muted small">Set an intentional Nigerian price. The local currency estimate on the public pricing page is not a checkout price.</p><label className="consent-line"><input type="checkbox" name="is_active" value="yes" defaultChecked={ngn?.is_active ?? true} /> Make this NGN price available when billing opens</label><button className="button button-secondary button-small" type="submit">Save NGN price</button></form> : null}
            </article>;
          })}</div>
        </section>
        <aside className="panel dashboard-section">
          <div className="dashboard-section-head"><h2>Marketplace fee</h2><Percent size={18} color="#087f71" /></div>
          <p className="muted small">Applied to new marketplace orders. The maximum allowed setting is 20%.</p>
          <form className="form-grid admin-fee-form" action={adminUpdateMarketplaceFeeAction}><label className="form-field"><span>Fee percentage</span><input name="fee_percent" inputMode="decimal" defaultValue={(feeBps / 100).toFixed(2)} min="0" max="20" step="0.01" required /></label><button className="button button-primary button-small" type="submit">Update fee</button></form>
        </aside>
      </div>
    </>
  );
}
