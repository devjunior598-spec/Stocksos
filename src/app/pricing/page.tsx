import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/data";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = supabase
    ? await supabase.from("subscription_plans").select("id,name,monthly_price_kobo,benefits").eq("is_active", true).order("monthly_price_kobo")
    : { data: null };
  const plans = (data ?? []) as { id: string; name: string; monthly_price_kobo: number; benefits: string[] }[];
  return (
    <>
      <section className="page-hero"><div className="page-container"><span className="eyebrow">Plans and pricing</span><h1>Start with what your business needs.</h1><p className="lead">Explore the plans available to your business. Paid subscriptions and online billing are not yet available.</p></div></section>
      <section className="section-tight"><div className="page-container">
        <SupabaseSetupNotice />
        {plans.length ? <div className="card-grid">{plans.map((plan) => <article className="feature-card" key={plan.id}>
          <span className="eyebrow">{plan.name}</span><h2 style={{ fontSize: 31, marginTop: 16 }}>{plan.monthly_price_kobo === 0 ? "Free" : formatMoney(plan.monthly_price_kobo)}<small className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{plan.monthly_price_kobo ? " / month" : ""}</small></h2>
          <ul className="plan-benefits">{plan.benefits.map((benefit) => <li key={benefit}><BadgeCheck size={15} />{benefit}</li>)}</ul>
          <Link className="button button-secondary" href="/become-supplier">Get started <ArrowRight size={15} /></Link>
        </article>)}</div> : <div className="empty-state"><h3>Plans are unavailable right now</h3><p>Please check back later or contact support for help.</p><Link className="text-link" href="/contact">Contact support <ArrowRight size={15} /></Link></div>}
      </div></section>
    </>
  );
}
