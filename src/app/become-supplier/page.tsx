import Link from "next/link";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { createBusinessApplicationAction } from "@/app/actions";
import { getAuthenticatedUser } from "@/lib/auth";
import { getCategories } from "@/lib/data";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";

type Props = { searchParams: Promise<{ error?: string; applied?: string }> };

export default async function BecomeSupplierPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await getAuthenticatedUser();
  const categories = await getCategories();
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return (
    <>
      <section className="page-hero"><div className="page-container"><span className="eyebrow"><Building2 size={14} /> Sell stock on StockSOS</span><h1>Reach buyers when they need supply.</h1><p className="lead">Apply with your business details. Approved suppliers can list inventory and send quotations to matching requests.</p></div></section>
      <section className="page-container">
        {!configured ? <div className="form-panel"><SupabaseSetupNotice /></div> : !user ? <div className="form-panel empty-state"><div className="empty-state-icon"><ShieldCheck size={22} /></div><h3>Create your account first</h3><p>Business applications are tied to the owner’s verified StockSOS account.</p><Link className="button button-primary" href="/register">Create account <ArrowRight size={15} /></Link></div> : (
          <div className="form-panel">
            {params.applied ? <div className="notice success-notice" role="status"><div><strong>Application submitted.</strong><p>Your business is pending review. Supplier features unlock after approval.</p></div></div> : null}
            {params.error ? <div className="notice error-notice" role="alert"><div><strong>We couldn’t save the application.</strong><p>{params.error === "slug" ? "That business link is already taken. Choose another." : "Review the details and try again."}</p></div></div> : null}
            <div className="auth-panel">
              <form action={createBusinessApplicationAction}>
                <div className="form-field"><label htmlFor="name">Business name</label><input id="name" name="name" required minLength={2} maxLength={120} /></div>
                <div className="form-field"><label htmlFor="slug">Shareable business link</label><input id="slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120} placeholder="your-business-name" /><span className="form-hint">Your profile will be available at /business/your-link.</span></div>
                <div className="form-grid">
                  <div className="form-field"><label htmlFor="category_id">Main business category</label><select id="category_id" name="category_id" required defaultValue=""><option value="" disabled>Select a category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div>
                  <div className="form-field"><label htmlFor="city">City</label><input id="city" name="city" required minLength={2} maxLength={100} placeholder="Ibadan" /></div>
                </div>
                <div className="form-grid">
                  <div className="form-field"><label htmlFor="area">Area <span className="muted">(optional)</span></label><input id="area" name="area" maxLength={100} /></div>
                  <div className="form-field"><label htmlFor="phone">Business phone <span className="muted">(optional)</span></label><input id="phone" name="phone" type="tel" maxLength={30} /></div>
                </div>
                <div className="form-grid">
                  <div className="form-field"><label htmlFor="email">Business email <span className="muted">(optional)</span></label><input id="email" name="email" type="email" /></div>
                  <div className="form-field"><label htmlFor="registration_number">Registration number <span className="muted">(optional)</span></label><input id="registration_number" name="registration_number" maxLength={100} /></div>
                </div>
                <div className="form-field"><label htmlFor="description">Tell buyers about the business <span className="muted">(optional)</span></label><textarea id="description" name="description" maxLength={1000} /></div>
                <div className="notice"><ShieldCheck size={16} /><div><strong>Review required before selling.</strong><p>The application starts as pending. Only approved businesses appear in public search and SOS matching.</p></div></div>
                <button className="button button-primary form-submit" type="submit">Submit business application <ArrowRight size={15} /></button>
              </form>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
