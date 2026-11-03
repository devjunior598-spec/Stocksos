import Link from "next/link";
import { ArrowLeft, ArrowRight, Bot, LockKeyhole, MessageCircle, ShieldCheck } from "lucide-react";
import { requireSupplier } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveSalesAssistantSettings } from "./actions";
import { hasPaidAssistantAccess } from "@/lib/sales-assistant";

export const dynamic = "force-dynamic";

type Business = { id: string; name: string; verification_status: string };

export default async function SupplierSalesAssistantPage({ searchParams }: {
  searchParams: Promise<{ business?: string; saved?: string; error?: string }>;
}) {
  const user = await requireSupplier();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: memberships, error: memberError } = await supabase!.from("business_memberships")
    .select("business_id,role,businesses(id,name,verification_status)").eq("user_id", user.id);
  const manageable = (memberships ?? []).flatMap((row) => {
    const business = (Array.isArray(row.businesses) ? row.businesses[0] : row.businesses) as Business | null;
    return business && business.verification_status === "approved" && ["owner", "admin"].includes(row.role) ? [business] : [];
  });
  const selected = manageable.find((business) => business.id === params.business) ?? manageable[0];
  const [settingsResult, entitlementResult] = selected ? await Promise.all([
    supabase!.from("sales_assistant_settings").select("enabled,greeting,delivery_notes,returns_notes,handoff_notes").eq("business_id", selected.id).maybeSingle(),
    supabase!.from("sales_assistant_entitlements").select("status,paid_through").eq("business_id", selected.id).maybeSingle(),
  ]) : [{ data: null, error: null }, { data: null, error: null }];
  const settings = settingsResult.data;
  const entitlement = entitlementResult.data;
  const paid = hasPaidAssistantAccess(entitlement);
  const modelReady = Boolean(process.env.OPENAI_API_KEY);
  const canActivate = paid && modelReady;
  const unavailable = Boolean(memberError || settingsResult.error || entitlementResult.error);
  const schemaMissing = [settingsResult.error?.code, entitlementResult.error?.code].some((code) => code === "42P01" || code === "PGRST205");

  return <section className="dashboard-shell"><div className="page-container sales-assistant-page">
    <Link className="text-link marketplace-back" href="/supplier"><ArrowLeft size={15} /> Supplier workspace</Link>
    <div className="dashboard-top"><div><span className="eyebrow"><Bot size={15} /> Sales assistant</span><h1>Be ready when buyers ask.</h1><p className="muted">Prepare an on-site assistant that answers from your live listings and sends interested buyers into the existing enquiry workflow.</p></div><span className="pill"><LockKeyhole size={13} /> Paid feature</span></div>
    {params.saved ? <div className="notice success-notice" role="status"><strong>Assistant settings saved.</strong></div> : null}
    {params.error ? <div className="notice error-notice" role="alert"><strong>{params.error === "subscription" ? "An active paid entitlement is required before activation." : params.error === "model" ? "AI replies are not configured on this deployment yet." : params.error === "access" ? "Only an approved business owner or administrator can manage this assistant." : params.error === "invalid" ? "Please check the length of your answers and try again." : "Settings could not be saved. Please try again."}</strong></div> : null}
    {unavailable ? <div className="notice error-notice" role="alert"><strong>{schemaMissing ? "Assistant database setup is pending in this environment. You can review the controls here; saving will open after the migration is applied." : memberError ? "Your businesses could not be loaded. Refresh and try again." : "Assistant settings could not be loaded. Refresh before making changes."}</strong></div> : null}
    <div className="sales-assistant-layout"><div>
      <section className="panel dashboard-section"><div className="dashboard-section-head"><div><h2>Your assistant setup</h2><p className="muted small">One assistant per approved business. It never changes product prices or stock.</p></div><MessageCircle size={19} /></div>
        {manageable.length > 1 ? <div className="sales-assistant-businesses" aria-label="Choose a business">{manageable.map((business) => <Link className={business.id === selected?.id ? "pill pill-green" : "pill"} href={`/supplier/sales-assistant?business=${business.id}`} key={business.id}>{business.name}</Link>)}</div> : null}
        {!selected ? <p className="muted">Add an approved business before setting up the assistant. <Link className="text-link" href="/become-supplier">Set up business <ArrowRight size={13} /></Link></p> : <form action={saveSalesAssistantSettings} className="sales-assistant-form">
          <input type="hidden" name="business_id" value={selected.id} />
          <div className="form-field"><label htmlFor="sa-greeting">Welcome message</label><textarea id="sa-greeting" name="greeting" minLength={10} maxLength={240} required defaultValue={settings?.greeting ?? "Hi! Ask me about this product and I will help you get the details you need."} /><small className="form-hint">The first message buyers see on your product listings.</small></div>
          <div className="form-field"><label htmlFor="sa-delivery">Delivery and pickup details</label><textarea id="sa-delivery" name="delivery_notes" maxLength={800} defaultValue={settings?.delivery_notes ?? ""} placeholder="Where you deliver, pickup options, expected timing and how fees are confirmed" /><small className="form-hint">Only include terms you can honor. Leave blank if delivery is arranged case by case.</small></div>
          <div className="form-field"><label htmlFor="sa-returns">Returns and product questions</label><textarea id="sa-returns" name="returns_notes" maxLength={800} defaultValue={settings?.returns_notes ?? ""} placeholder="Your actual returns policy and what buyers should check before ordering" /></div>
          <div className="form-field"><label htmlFor="sa-handoff">When to involve your team</label><textarea id="sa-handoff" name="handoff_notes" maxLength={500} defaultValue={settings?.handoff_notes ?? ""} placeholder="Examples: bulk discounts, custom specifications or urgent delivery" /><small className="form-hint">The assistant will ask buyers to send an enquiry whenever a decision needs you.</small></div>
          <label className="sales-assistant-toggle"><input type="checkbox" name="enabled" defaultChecked={settings?.enabled && canActivate} disabled={!canActivate || unavailable} /><span><strong>Answer buyers on public product pages</strong><small>{canActivate ? "Turn off at any time. Only available while your paid period remains active." : "Activation opens after verified billing and AI service setup."}</small></span></label>
          <button className="button button-primary" type="submit" disabled={unavailable}>Save assistant settings <ArrowRight size={15} /></button>
        </form>}
      </section>
    </div><aside className="sales-assistant-aside">
      <section className="panel dashboard-section"><ShieldCheck size={22} /><h2>Current status</h2><p><strong>{selected?.name ?? "No approved business"}</strong></p><p className="muted small">{!paid ? "Paid access is not active. No customer-facing assistant is running." : !modelReady ? "Payment access is active, but the AI service is not configured." : settings?.enabled ? "Assistant is available on eligible public listings." : "Ready to activate when you turn it on."}</p>{!paid ? <Link className="text-link" href="/contact">Ask about paid early access <ArrowRight size={14} /></Link> : null}</section>
      <section className="panel dashboard-section"><h2>What it can do</h2><ul className="sales-assistant-list"><li>Answer from current public price, stock and product details.</li><li>Explain only the delivery and return terms you provide.</li><li>Help a buyer send an enquiry or request a quotation.</li><li>Keep checkout and payment claims outside the conversation.</li></ul><p className="muted small">Automatic ads, outbound messages, payment links and sales receipts are separate future steps.</p></section>
    </aside></div>
  </div></section>;
}
