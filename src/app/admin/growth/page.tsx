import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, CircleAlert, ShieldCheck } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/data";
import { summarizeVerifiedPayments, type VerifiedPayment } from "@/lib/growth-metrics";

export const dynamic = "force-dynamic";

function displayCount(result: { count: number | null; error: unknown }) {
  return result.error || result.count === null ? "—" : result.count.toLocaleString("en-US");
}

function thirtyDaysAgo() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

export default async function AdminGrowthPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const windowStart = thirtyDaysAgo();
  const [requests, matches, quotations, orders, completedOrders, verifiedPayments, approvedSuppliers] = await Promise.all([
    supabase!.from("sos_requests").select("id", { count: "exact", head: true }).gte("created_at", windowStart),
    supabase!.from("supplier_matches").select("id", { count: "exact", head: true }).gte("created_at", windowStart),
    supabase!.from("quotations").select("id", { count: "exact", head: true }).gte("created_at", windowStart),
    supabase!.from("orders").select("id", { count: "exact", head: true }).gte("created_at", windowStart),
    supabase!.from("orders").select("id", { count: "exact", head: true }).eq("status", "completed").gte("created_at", windowStart),
    supabase!.from("payments").select("id", { count: "exact", head: true }).eq("status", "succeeded").gte("verified_at", windowStart),
    supabase!.from("businesses").select("id", { count: "exact", head: true }).eq("verification_status", "approved"),
  ]);

  const paymentRows = !verifiedPayments.error && verifiedPayments.count !== null && verifiedPayments.count <= 1000
    ? await supabase!.from("payments")
      .select("id,status,amount_kobo,currency,verified_at")
      .eq("status", "succeeded")
      .gte("verified_at", windowStart)
      .order("verified_at", { ascending: false })
      .limit(1000)
    : null;
  const volume = paymentRows?.error ? null
    : paymentRows && verifiedPayments.count !== null
      ? summarizeVerifiedPayments((paymentRows.data ?? []) as VerifiedPayment[], verifiedPayments.count)
      : null;
  const dataUnavailable = [requests, matches, quotations, orders, completedOrders, verifiedPayments, approvedSuppliers]
    .some((result) => result.error) || Boolean(paymentRows?.error);
  const stages = [
    { label: "Buyer requests", detail: "New SOS requests", result: requests },
    { label: "Supplier matches", detail: "Opportunities routed to suppliers", result: matches },
    { label: "Quotations", detail: "Offers created by suppliers", result: quotations },
    { label: "Orders", detail: "Accepted offers that became orders", result: orders },
    { label: "Completed orders", detail: "Orders from this period now completed", result: completedOrders },
    { label: "Verified payments", detail: "Successful payments verified by the provider", result: verifiedPayments },
  ];
  const largest = Math.max(1, ...stages.map((stage) => stage.result.error ? 0 : stage.result.count ?? 0));

  return <>
    <div className="admin-page-heading"><div><span className="eyebrow"><ChartNoAxesCombined size={14} /> Marketplace growth</span><h1>Know what is actually working.</h1><p>Live marketplace activity from the last 30 days. These are operational records, not forecasts.</p></div><span className="pill"><ShieldCheck size={12} /> Admin only</span></div>
    {dataUnavailable ? <div className="notice error-notice" role="alert"><CircleAlert size={18} /><div><strong>Some growth data could not be loaded.</strong><p>Unavailable figures are hidden. Refresh before sharing a report.</p></div></div> : null}

    <div className="dashboard-grid admin-summary-grid">
      <article className="stat-card"><span>Approved suppliers</span><strong>{displayCount(approvedSuppliers)}</strong><small>All time</small></article>
      <article className="stat-card"><span>Buyer requests</span><strong>{displayCount(requests)}</strong><small>Last 30 days</small></article>
      <article className="stat-card"><span>Verified payments</span><strong>{displayCount(verifiedPayments)}</strong><small>Last 30 days</small></article>
    </div>

    <section className="panel dashboard-section" aria-labelledby="growth-activity-title">
      <div className="dashboard-section-head"><div><h2 id="growth-activity-title">Demand to order activity</h2><p className="muted small">Each row counts records created in this period. Supplier matches and quotations can outnumber requests; this is not a cohort conversion rate.</p></div><ChartNoAxesCombined size={18} /></div>
      <div className="growth-stages">{stages.map((stage) => <div className="growth-stage" key={stage.label}>
        <div><strong>{stage.label}</strong><small>{stage.detail}</small></div>
        <span className="growth-stage-track" aria-hidden="true"><span style={{ width: `${stage.result.error ? 0 : Math.max(0, (stage.result.count ?? 0) / largest * 100)}%` }} /></span>
        <b>{displayCount(stage.result)}</b>
      </div>)}</div>
    </section>

    <div className="dashboard-columns admin-columns">
      <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Verified payment volume</h2></div>
        {volume?.length ? <div className="growth-volume-list">{volume.map(({ currency, amountMinor }) => <div key={currency}><span>{currency}</span><strong>{formatMoney(amountMinor, currency)}</strong></div>)}</div>
          : volume ? <p className="muted small">No provider-verified payments in the last 30 days.</p>
            : <p className="muted small">A complete verified payment total is unavailable. Check the payment data before sharing a financial figure.</p>}
        <p className="muted small">Payment volume is the amount charged to buyers. It is not StockSOS revenue or profit; fees, refunds, chargebacks and supplier payouts require reconciliation.</p>
      </section>
      <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Turn activity into evidence</h2></div>
        <p className="muted small">Improve supplier coverage, response time and completed orders before making growth claims. Measure paid subscriptions separately once billing is live.</p>
        <div className="growth-next-actions"><Link href="/admin/accounts">Review supplier approvals <ArrowRight size={14} /></Link><Link href="/admin/orders">Inspect order outcomes <ArrowRight size={14} /></Link><Link href="/admin/support">Resolve buyer issues <ArrowRight size={14} /></Link></div>
      </section>
    </div>
  </>;
}
