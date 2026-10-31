import Link from "next/link";
import { ArrowRight, CircleAlert, LifeBuoy, PackageCheck, ShieldCheck } from "lucide-react";
import { createSupportCaseAction } from "@/app/actions";
import { getAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InfoPage } from "@/components/info-page";

type Props = { searchParams: Promise<{ error?: string; sent?: string }> };

export default async function ContactPage({ searchParams }: Props) {
  const [user, query] = await Promise.all([getAuthenticatedUser(), searchParams]);
  if (!user) return <InfoPage
    eyebrow="Contact and support"
    title="We’re here to help your business move."
    intro="For account, order, supplier verification or payment questions, sign in to open a support case tied to your StockSOS account."
    cards={[
      { title: "Existing order or payment", description: "Open a support case with your order attached. Never share card details or passwords in a support message." },
      { title: "Supplier application", description: "Sign in to review your business workspace and application status." },
    ]}
    sections={[{ heading: "Need help now?", paragraphs: ["Your message will be connected to your account so the support team can review it securely."] }]}
    action={{ label: "Sign in to contact support", href: "/login?next=%2Fcontact" }}
  />;

  const supabase = await createSupabaseServerClient();
  const { data: orders } = await supabase!.from("orders").select("id,status,created_at")
    .eq("buyer_id", user.id).order("created_at", { ascending: false }).limit(20);

  return <>
    <section className="page-hero"><div className="page-container"><span className="eyebrow"><LifeBuoy size={14} /> Contact and support</span><h1>How can we help?</h1><p className="lead">Open a case tied to your StockSOS account. Share order references when useful, and never send card details or passwords.</p></div></section>
    <section className="page-container section-tight"><div className="form-panel support-form-panel">
      {query.sent ? <div className="notice success-notice"><ShieldCheck size={17} /><div><strong>Support case received.</strong><p>Your message is in the support queue.</p></div></div> : null}
      {query.error ? <div className="notice error-notice"><CircleAlert size={17} /><div><strong>{query.error === "rate" ? "Support request limit reached." : "We couldn’t send your message."}</strong><p>{query.error === "rate" ? "Please wait before sending another support request." : "Check the fields and try again."}</p></div></div> : null}
      <div className="auth-panel"><form action={createSupportCaseAction}>
        <div className="form-field"><label htmlFor="subject">What do you need help with?</label><input id="subject" name="subject" required minLength={3} maxLength={160} placeholder="e.g. Question about a delivery" /></div>
        <div className="form-field"><label htmlFor="order_id">Related order <span className="muted">(optional)</span></label><select id="order_id" name="order_id" defaultValue=""><option value="">No order selected</option>{orders?.map((order) => <option key={order.id} value={order.id}>#{order.id.slice(0, 8)} · {order.status.replaceAll("_", " ")}</option>)}</select></div>
        <div className="form-field"><label htmlFor="message">Message</label><textarea id="message" name="message" required minLength={10} maxLength={5000} placeholder="Describe what happened and what you need." /></div>
        <button className="button button-primary form-submit" type="submit"><PackageCheck size={16} /> Send support request</button>
      </form></div>
      <p className="form-bottom"><Link href="/help">Visit the Help Centre <ArrowRight size={13} /></Link></p>
    </div></section>
  </>;
}
