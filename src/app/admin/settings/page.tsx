import { Check, CircleAlert, Percent, Settings2, ShieldCheck } from "lucide-react";
import { adminUpdateMarketplaceFeeAction, adminUpdatePlanAction } from "@/app/actions";
import { formatMoney } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; plan?: string; fee?: string }> }) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [plansResult, feeResult] = await Promise.all([
    supabase!.from("subscription_plans").select("id,name,monthly_price_kobo,benefits,is_active,updated_at").order("monthly_price_kobo"),
    supabase!.from("platform_settings").select("value,updated_at").eq("key", "marketplace_fee_bps").maybeSingle(),
  ]);
  const feeBps = typeof feeResult.data?.value === "number" ? feeResult.data.value : Number(feeResult.data?.value ?? 0);

  return (
    <>
      <div className="admin-page-heading"><div><span className="eyebrow"><Settings2 size={14} /> Platform settings</span><h1>Control commercial settings.</h1><p>Manage supplier subscription plans and the platform marketplace fee from one protected workspace.</p></div><span className="pill"><ShieldCheck size={12} /> Audited changes</span></div>
      {params.error ? <div className="notice error-notice"><CircleAlert size={17} /><div><strong>The setting was not saved.</strong><p>Review the value and try again.</p></div></div> : null}
      {params.plan || params.fee ? <div className="notice success-notice"><Check size={17} /><div><strong>Settings updated.</strong><p>The change is live and recorded in the audit log.</p></div></div> : null}

      <div className="dashboard-columns admin-settings-columns">
        <section className="panel dashboard-section">
          <div className="dashboard-section-head"><h2>Subscription plans</h2><Settings2 size={18} color="#087f71" /></div>
          <div className="admin-plan-list">{plansResult.data?.map((plan) => {
            const benefits = Array.isArray(plan.benefits) ? plan.benefits.filter((item): item is string => typeof item === "string") : [];
            return <article className="admin-plan" key={plan.id}><div className="admin-plan-heading"><div><span className={`pill${plan.is_active ? " pill-green" : " pill-red"}`}>{plan.is_active ? "Active" : "Inactive"}</span><h3>{plan.name}</h3><p>{formatMoney(plan.monthly_price_kobo, "USD")} per month</p></div></div><form className="form-grid" action={adminUpdatePlanAction}><input type="hidden" name="plan_id" value={plan.id} /><label className="form-field"><span>Monthly price (USD)</span><input name="price" inputMode="decimal" defaultValue={(plan.monthly_price_kobo / 100).toFixed(2)} required /></label><label className="form-field"><span>Benefits, one per line</span><textarea name="benefits" rows={5} defaultValue={benefits.join("\n")} /></label><label className="consent-line"><input type="checkbox" name="is_active" value="yes" defaultChecked={plan.is_active} /> Keep this plan available</label><button className="button button-primary button-small" type="submit">Save plan</button></form></article>;
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
