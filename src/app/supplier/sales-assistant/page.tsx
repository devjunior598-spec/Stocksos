import Link from "next/link";
import { ArrowLeft, ArrowRight, Bot, Check, ChevronDown, CircleCheck, CircleHelp, LockKeyhole, MessageCircle, PackageCheck, ShieldCheck, Sparkles } from "lucide-react";
import { requireSupplier } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPaidAssistantAccess } from "@/lib/sales-assistant";
import { saveSalesAssistantSettings } from "./actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type Business = { id: string; name: string; verification_status: string };
const starterGreeting = "Hi! Ask me about this product and I will help you get the details you need.";

function StatusRow({ done, title, description }: { done: boolean; title: string; description: string }) {
  return <li className={styles.statusRow}><span className={done ? styles.statusDone : styles.statusPending} aria-hidden="true">{done ? <Check size={13} /> : <LockKeyhole size={12} />}</span><span><strong>{title}</strong><small>{description}</small></span></li>;
}

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
  const paid = hasPaidAssistantAccess(entitlementResult.data);
  const modelReady = Boolean(process.env.OPENAI_API_KEY);
  const canActivate = paid && modelReady;
  const unavailable = Boolean(memberError || settingsResult.error || entitlementResult.error);
  const schemaMissing = [settingsResult.error?.code, entitlementResult.error?.code].some((code) => code === "42P01" || code === "PGRST205");
  const active = Boolean(settings?.enabled && canActivate && !unavailable);
  const greeting = settings?.greeting ?? starterGreeting;
  const errorMessage = params.error === "subscription" ? "An active paid entitlement is required before activation."
    : params.error === "model" ? "AI replies are not configured on this deployment yet."
    : params.error === "access" ? "Only an approved business owner or administrator can manage this assistant."
    : params.error === "invalid" ? "Please check the length of your answers and try again."
    : "Settings could not be saved. Please try again.";

  return <section className={styles.page}><div className={styles.container}>
    <Link className={styles.backLink} href="/supplier"><ArrowLeft size={15} /> Supplier workspace</Link>
    <header className={styles.hero}>
      <div className={styles.heroContent}>
        <div className={styles.heroEyebrow}><span className={styles.heroIcon}><Sparkles size={17} /></span> STOCKSOS SALES ASSISTANT <span className={styles.heroDivider} /> SUPPLIER TOOLS</div>
        <h1>Be there for buyers,<br /><em>even when you&apos;re away.</em></h1>
        <p>Give your product pages a helpful first response. Set the words and boundaries now; public replies only start after paid access and AI service setup.</p>
        <div className={styles.heroFooter}><span className={styles.heroState}><span className={active ? styles.liveDot : styles.offDot} /> {active ? "Live on eligible listings" : "Not answering buyers yet"}</span><span className={styles.heroRule}><ShieldCheck size={14} /> You control the information it uses</span></div>
      </div>
      <div className={styles.heroArt} aria-hidden="true"><span className={styles.artOrbitOne} /><span className={styles.artOrbitTwo} /><span className={styles.artCore}><Bot size={58} strokeWidth={1.3} /></span><span className={styles.artSparkleOne}>✦</span><span className={styles.artSparkleTwo}>✦</span></div>
    </header>

    {params.saved ? <div className={styles.successNotice} role="status"><CircleCheck size={18} /><span><strong>Changes saved.</strong> Your assistant instructions are up to date.</span></div> : null}
    {params.error ? <div className={styles.errorNotice} role="alert"><CircleHelp size={18} /><strong>{errorMessage}</strong></div> : null}
    {unavailable ? <div className={styles.errorNotice} role="alert"><CircleHelp size={18} /><strong>{schemaMissing ? "Assistant database setup is pending here. You can review the controls; saving opens after the migration is applied." : memberError ? "Your businesses could not be loaded. Refresh and try again." : "Assistant settings could not be loaded. Refresh before making changes."}</strong></div> : null}

    <div className={styles.workspace}><div className={styles.mainColumn}>
      <div className={styles.sectionIntro}><div><span className={styles.kicker}>YOUR WORKSPACE</span><h2>Shape every first conversation.</h2><p>Start with your welcome message, then add the practical details buyers ask for most.</p></div><span className={styles.planBadge}><LockKeyhole size={13} /> Paid feature</span></div>
      {manageable.length > 1 ? <nav className={styles.businessPicker} aria-label="Choose a business">{manageable.map((business) => <Link className={business.id === selected?.id ? styles.businessActive : styles.businessOption} href={`/supplier/sales-assistant?business=${business.id}`} key={business.id}>{business.name}</Link>)}</nav> : null}
      {!selected ? <section className={styles.emptyCard}><PackageCheck size={26} /><h3>Set up your business first</h3><p>Add an approved business to prepare an assistant for its product listings.</p><Link className="button button-primary" href="/become-supplier">Set up business <ArrowRight size={15} /></Link></section> : <form action={saveSalesAssistantSettings} className={styles.form}>
        <input type="hidden" name="business_id" value={selected.id} />
        <section className={styles.formCard} aria-labelledby="assistant-voice-heading"><div className={styles.cardHeading}><span className={styles.stepNumber}>01</span><div><span className={styles.cardLabel}>FIRST IMPRESSION</span><h3 id="assistant-voice-heading">How should it greet a buyer?</h3><p>This is the first message shown on your eligible product pages.</p></div><MessageCircle className={styles.cardIcon} size={21} /></div><div className={styles.field}><label htmlFor="sa-greeting">Welcome message <span>Required</span></label><textarea id="sa-greeting" name="greeting" minLength={10} maxLength={240} required defaultValue={greeting} /><small>Keep it warm and direct. Buyers can ask about the listing after this message.</small></div></section>
        <section className={styles.formCard} aria-labelledby="assistant-delivery-heading"><div className={styles.cardHeading}><span className={styles.stepNumber}>02</span><div><span className={styles.cardLabel}>PRACTICAL DETAILS</span><h3 id="assistant-delivery-heading">What can you fulfil?</h3><p>Write only the delivery and pickup terms your business can honor.</p></div><PackageCheck className={styles.cardIcon} size={21} /></div><div className={styles.field}><label htmlFor="sa-delivery">Delivery and pickup details <span>Optional</span></label><textarea id="sa-delivery" name="delivery_notes" maxLength={800} defaultValue={settings?.delivery_notes ?? ""} placeholder="Delivery areas, pickup options, usual timing, and how you confirm fees" /><small>Leave this blank if arrangements depend on the order.</small></div></section>
        <details className={styles.moreCard} open={Boolean(settings?.returns_notes || settings?.handoff_notes)}><summary><span className={styles.stepNumber}>03</span><span className={styles.moreTitle}><span className={styles.cardLabel}>MORE CONTROL</span><strong>Returns and team handoff</strong><small>Add policies and tell the assistant when a person should take over.</small></span><ChevronDown className={styles.chevron} size={19} /></summary><div className={styles.moreFields}><div className={styles.field}><label htmlFor="sa-returns">Returns and product questions <span>Optional</span></label><textarea id="sa-returns" name="returns_notes" maxLength={800} defaultValue={settings?.returns_notes ?? ""} placeholder="Your actual returns policy and what buyers should check before ordering" /></div><div className={styles.field}><label htmlFor="sa-handoff">When to involve your team <span>Optional</span></label><textarea id="sa-handoff" name="handoff_notes" maxLength={500} defaultValue={settings?.handoff_notes ?? ""} placeholder="For example: bulk discounts, custom specifications, or urgent delivery" /><small>The assistant directs these questions to an enquiry instead of deciding for you.</small></div></div></details>
        <section className={styles.activationCard} aria-labelledby="assistant-activation-heading"><div className={styles.activationIcon}><LockKeyhole size={20} /></div><div className={styles.activationCopy}><span className={styles.cardLabel}>WHEN YOU ARE READY</span><h3 id="assistant-activation-heading">Turn on public replies</h3><p>{canActivate ? "You can switch the assistant off whenever you need to." : "Activation opens after paid access and AI service setup are verified."}</p></div><label className={styles.switchLabel}><input type="checkbox" name="enabled" defaultChecked={active} disabled={!canActivate || unavailable} aria-label="Answer buyers on public product pages" /><span aria-hidden="true" /></label></section>
        <div className={styles.saveBar}><p><ShieldCheck size={15} /> Your changes affect only {selected.name}.</p><button className="button button-primary" type="submit" disabled={unavailable}>Save instructions <ArrowRight size={16} /></button></div>
      </form>}
    </div><aside className={styles.sideColumn} aria-label="Assistant status and preview">
      <section className={styles.previewCard}><div className={styles.previewTop}><span className={styles.previewMark}><Bot size={19} /></span><div><strong>Saved welcome preview</strong><small>What a buyer sees first</small></div><span className={styles.previewDots} aria-hidden="true">•••</span></div><div className={styles.previewBody}><span className={styles.previewProduct}><PackageCheck size={15} /> On a product listing</span><div className={styles.previewMessage}><span className={styles.previewAvatar}><Bot size={16} /></span><p>{greeting}</p></div></div><p className={styles.previewFooter}>Updates after saving · No AI replies are sent here</p></section>
      <section className={styles.readinessCard}><div className={styles.readinessHead}><div><span className={styles.kicker}>CURRENT STATUS</span><h3>{active ? "Assistant is live" : "Not active yet"}</h3></div><span className={active ? styles.readyIndicator : styles.pendingIndicator}>{active ? "LIVE" : "OFF"}</span></div><p className={styles.businessName}>{selected?.name ?? "No approved business"}</p><ul className={styles.statusList}><StatusRow done={Boolean(selected)} title="Approved business" description={selected ? "Ready to prepare instructions" : "Set up an approved business"} /><StatusRow done={paid} title="Paid access" description={paid ? "Verified for this business" : "Not active"} /><StatusRow done={modelReady} title="AI service" description={modelReady ? "Connected" : "Awaiting setup"} /></ul>{!paid ? <Link className={styles.earlyLink} href="/contact">Ask about paid early access <ArrowRight size={15} /></Link> : null}</section>
      <section className={styles.boundariesCard}><ShieldCheck size={21} /><h3>Built to stay within your terms.</h3><p>Replies use current public product details and the instructions you save. Price changes, payment links, automatic ads and receipts are not part of this assistant.</p></section>
    </aside></div>
  </div></section>;
}
