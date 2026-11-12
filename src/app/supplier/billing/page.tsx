import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, CreditCard, ReceiptText } from "lucide-react";
import { requireSupplier } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/data";

export const dynamic = "force-dynamic";

type Business = { id: string; name: string; verification_status: string };
type Subscription = {
  id: string; plan_id: string; status: string;
  period_starts_at: string | null; period_ends_at: string | null;
};
type Payment = {
  id: string; plan_id: string; currency: string; amount_minor: number;
  paid_at: string; period_starts_at: string; period_ends_at: string;
};

function date(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

export default async function SupplierBillingPage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const user = await requireSupplier();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const membershipResult = await supabase!.from("business_memberships")
    .select("business_id,role,businesses(id,name,verification_status)")
    .eq("user_id", user.id).in("role", ["owner", "admin"]);
  const businesses = (membershipResult.data ?? []).flatMap((membership): Business[] => {
    const business = Array.isArray(membership.businesses) ? membership.businesses[0] : membership.businesses;
    return business && business.verification_status === "approved" ? [business] : [];
  });
  const selected = businesses.find((business) => business.id === params.business) ?? businesses[0];
  const [subscriptionsResult, paymentsResult, plansResult] = selected ? await Promise.all([
    supabase!.from("business_subscriptions").select("id,plan_id,status,period_starts_at,period_ends_at")
      .eq("business_id", selected.id).order("created_at", { ascending: false }).limit(50),
    supabase!.from("subscription_payments").select("id,plan_id,currency,amount_minor,paid_at,period_starts_at,period_ends_at")
      .eq("business_id", selected.id).order("paid_at", { ascending: false }).limit(20),
    supabase!.from("subscription_plans").select("id,name"),
  ]) : [null, null, null];
  // Server-rendered billing status must compare stored periods to the current request time.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const subscriptions = (subscriptionsResult?.data ?? []) as Subscription[];
  const current = subscriptions.find((item) => item.status === "active"
    && item.period_starts_at && item.period_ends_at
    && Date.parse(item.period_starts_at) <= now && Date.parse(item.period_ends_at) > now);
  const upcoming = subscriptions.filter((item) => item.status === "active"
    && item.period_starts_at && Date.parse(item.period_starts_at) > now);
  const payments = (paymentsResult?.data ?? []) as Payment[];
  const planNames = new Map((plansResult?.data ?? []).map((plan) => [plan.id, plan.name]));
  const dataUnavailable = Boolean(membershipResult.error || subscriptionsResult?.error || paymentsResult?.error || plansResult?.error);

  return <section className="supplier-marketplace-page"><div className="page-container">
    <Link className="text-link marketplace-back" href="/supplier"><ArrowLeft size={15} /> Supplier workspace</Link>
    <div className="marketplace-page-heading"><div><span className="eyebrow"><CreditCard size={14} /> Plans and billing</span><h1>Your plan, clearly tracked.</h1><p className="lead">See your current access, prepaid renewal dates and verified payment history for each approved business.</p></div></div>
    {dataUnavailable ? <div className="notice error-notice" role="alert"><strong>Billing information could not be loaded.</strong><p>Refresh the page. If this continues, contact support before paying again.</p></div> : null}
    {businesses.length > 1 ? <div className="sales-assistant-businesses" aria-label="Choose a business">{businesses.map((business) => <Link key={business.id} href={`/supplier/billing?business=${business.id}`} className={business.id === selected?.id ? "pill pill-green" : "pill"}>{business.name}</Link>)}</div> : null}
    {!selected ? <div className="panel dashboard-section"><h2>No approved business yet</h2><p>Complete your business profile before choosing a paid plan.</p><Link className="text-link" href="/become-supplier">Set up business <ArrowRight size={14} /></Link></div> : <div className="dashboard-columns">
      <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>{selected.name}</h2><CalendarDays size={18} /></div>
        {dataUnavailable ? <p className="muted">Current access is unavailable until billing records load.</p> : current ? <><p><strong>{planNames.get(current.plan_id) ?? current.plan_id}</strong> · Active</p><p className="muted small">Current paid period: {date(current.period_starts_at!)} – {date(current.period_ends_at!)} (UTC). Access ends at the listed time unless renewed.</p></> : <><p><strong>Free plan</strong></p><p className="muted small">No verified paid period is active for this business.</p></>}
        {upcoming.length ? <p className="muted small">{upcoming.length} prepaid period{upcoming.length > 1 ? "s" : ""} scheduled after the current one.</p> : null}
        <Link className="button button-primary button-small" href="/pricing">{current ? "Review renewal" : "Compare plans"} <ArrowRight size={14} /></Link>
      </section>
      <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Verified payments</h2><ReceiptText size={18} /></div>
        {payments.length ? <ul className="sales-assistant-list">{payments.map((payment) => <li key={payment.id}><strong>{planNames.get(payment.plan_id) ?? payment.plan_id}</strong> · {formatMoney(payment.amount_minor, payment.currency)} · paid {date(payment.paid_at)} · access through {date(payment.period_ends_at)}</li>)}</ul> : <p className="muted small">No verified supplier plan payments have been recorded here.</p>}
        <p className="muted small">This list shows supplier plan payments only. Marketplace order payments are tracked separately.</p>
      </section>
    </div>}
  </div></section>;
}
