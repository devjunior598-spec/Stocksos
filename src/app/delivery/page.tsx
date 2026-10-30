import Link from "next/link";
import { ArrowRight, Bike, CheckCircle2, Clock3, MapPin, ShieldCheck, Truck } from "lucide-react";
import { acceptDeliveryJobAction, applyDeliveryPartnerAction, updateDeliveryJobStatusAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";

export const dynamic = "force-dynamic";

function nextStatus(status: string) {
  if (status === "accepted") return { value: "picked_up", label: "Confirm pickup" };
  if (status === "picked_up") return { value: "in_transit", label: "Start delivery" };
  if (status === "in_transit") return { value: "delivered", label: "Confirm delivery" };
  return null;
}

export default async function DeliveryDashboardPage({ searchParams }: { searchParams: Promise<{ applied?: string; error?: string; job?: string; updated?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: partner } = await supabase!.from("delivery_partners").select("id,city,phone,verification_status").eq("user_id", user.id).maybeSingle();
  const approved = partner?.verification_status === "approved";
  const [openResult, assignedResult] = approved ? await Promise.all([
    supabase!.from("deliveries").select("id,order_id,delivery_city,pickup_area,delivery_area,status,created_at").eq("status", "requested").eq("delivery_city", partner.city).order("created_at").limit(30),
    supabase!.from("deliveries").select("id,order_id,delivery_city,pickup_area,delivery_area,status,created_at").eq("partner_id", partner.id).in("status", ["accepted", "picked_up", "in_transit"]).order("created_at").limit(30),
  ]) : [{ data: [] }, { data: [] }];
  const openJobs = openResult.data ?? [];
  const assignedJobs = assignedResult.data ?? [];

  return (
    <section className="dashboard-shell">
      <div className="page-container">
        <div className="dashboard-top"><div><span className="eyebrow"><Bike size={14} /> Delivery partner</span><h1>Local delivery workspace.</h1><p className="muted">Accept available jobs and update each fulfilment step.</p></div><span className="pill">Manual delivery network</span></div>
        <SupabaseSetupNotice />
        {params.applied ? <div className="notice success-notice"><div><strong>Application saved.</strong><p>Delivery access stays pending until StockSOS verifies the account.</p></div></div> : null}
        {params.error ? <div className="notice error-notice"><div><strong>We couldn’t complete that delivery action.</strong><p>Refresh the page and check that the job is still available.</p></div></div> : null}
        {!partner ? <div className="dashboard-columns">
          <section className="panel"><span className="feature-icon"><Truck size={19} /></span><h2>Apply as a delivery partner</h2><p className="muted">Delivery jobs include only the pickup and destination area until a job is accepted. Customer contact details are not shown in this workspace.</p>
            <form action={applyDeliveryPartnerAction}><div className="form-field"><label htmlFor="city">City you serve</label><input id="city" name="city" required minLength={2} maxLength={100} placeholder="Houston" /></div><div className="form-field"><label htmlFor="phone">Delivery phone <span className="muted">(optional)</span></label><input id="phone" name="phone" type="tel" maxLength={30} /></div><button className="button button-primary" type="submit">Submit for review <ArrowRight size={15} /></button></form>
          </section>
          <aside className="panel"><ShieldCheck size={20} color="#246bfe" /><h3>Verification before delivery access</h3><p className="muted small">Applications are reviewed by StockSOS administrators. Approved partners will see requests in the city they have registered.</p><Link className="text-link" href="/help">Read delivery help <ArrowRight size={14} /></Link></aside>
        </div> : !approved ? <div className="empty-state"><div className="empty-state-icon"><Clock3 size={21} /></div><h3>Application under review</h3><p>Your delivery profile is marked <span className="pill pill-orange">{partner.verification_status}</span>. You’ll be able to accept jobs after approval.</p></div> : (
          <>
            <div className="dashboard-grid"><article className="stat-card"><span>City</span><strong style={{ fontSize: 19 }}>{partner.city}</strong><span className="small">Your approved delivery area</span></article><article className="stat-card"><span>Available jobs</span><strong>{openJobs.length}</strong><span className="small">Requested in your city</span></article><article className="stat-card"><span>Accepted deliveries</span><strong>{assignedJobs.length}</strong><span className="small">Jobs assigned to your account</span></article><article className="stat-card"><span>Account</span><strong style={{ fontSize: 19 }}>Approved</strong><span className="small">Contact support for profile changes</span></article></div>
            <div className="dashboard-columns">
              <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>Available delivery jobs</h2><MapPin size={17} color="#246bfe" /></div>
                {openJobs.length ? <div className="delivery-list">{openJobs.map((job) => <article className="delivery-card" key={job.id}><div className="request-summary-head"><div><span className="pill pill-orange">Requested</span><h3>Delivery job</h3><p className="muted small">{job.delivery_city} · requested {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(job.created_at))}</p></div><Truck size={20} color="#246bfe" /></div><div className="delivery-route"><span><small>Pickup area</small><strong>{job.pickup_area || job.delivery_city}</strong></span><ArrowRight size={15} /><span><small>Drop-off area</small><strong>{job.delivery_area || job.delivery_city}</strong></span></div><form action={acceptDeliveryJobAction}><input type="hidden" name="delivery_id" value={job.id} /><button className="button button-primary button-small" type="submit">Accept job</button></form></article>)}</div> : <div className="empty-state"><div className="empty-state-icon"><Truck size={21} /></div><h3>No open jobs in {partner.city}</h3><p>When a supplier marks a paid order ready for delivery, the job will appear here.</p></div>}
              </section>
              <section className="panel dashboard-section"><div className="dashboard-section-head"><h2>My deliveries</h2><CheckCircle2 size={17} color="#16845b" /></div>
                {assignedJobs.length ? <div className="delivery-list">{assignedJobs.map((job) => { const next = nextStatus(job.status); return <article className="delivery-card" key={job.id}><div className="request-summary-head"><div><span className="pill">{job.status.replaceAll("_", " ")}</span><h3>Order #{job.order_id.slice(0, 8)}</h3><p className="muted small">{job.delivery_city} · {[job.pickup_area, job.delivery_area].filter(Boolean).join(" → ")}</p></div><Truck size={20} color="#246bfe" /></div>{next ? <form action={updateDeliveryJobStatusAction}><input type="hidden" name="delivery_id" value={job.id} /><input type="hidden" name="status" value={next.value} /><button className="button button-secondary button-small" type="submit">{next.label}</button></form> : <span className="muted small">No update needed</span>}</article>; })}</div> : <p className="muted small">Jobs you accept will appear here. Customer address and contact details are not shared in this initial delivery workflow.</p>}
              </section>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
