import Link from "next/link";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import { createBusinessApplicationAction } from "@/app/actions";
import { getAuthenticatedUser, getMarketplaceRole } from "@/lib/auth";
import { getCategories } from "@/lib/data";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { GlobalLocationFields } from "@/components/global-location-fields";
import { BusinessLinkFields } from "@/components/business-link-fields";

type Props = { searchParams: Promise<{ error?: string; applied?: string; field?: string }> };

const fieldLabels: Record<string, string> = {
  name: "business name", slug: "shareable business link", categoryId: "business category",
  country: "country", region: "state or region", city: "city", email: "business email",
};

export default async function BecomeSupplierPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await getAuthenticatedUser();
  const marketplaceRole = user ? await getMarketplaceRole(user.id) : null;
  const categories = await getCategories();
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return (
    <>
      <section className="page-hero"><div className="page-container"><span className="eyebrow"><Building2 size={14} /> Sell stock on StockSOS</span><h1>Reach buyers when they need supply.</h1><p className="lead">Apply with your business details. Approved suppliers can list inventory and send quotations to matching requests.</p></div></section>
      <section className="page-container">
        {!configured ? <div className="form-panel"><SupabaseSetupNotice /></div> : !user ? <div className="form-panel empty-state"><div className="empty-state-icon"><ShieldCheck size={22} /></div><h3>Create a supplier account first</h3><p>Business applications are tied to a verified supplier account.</p><Link className="button button-primary" href="/register">Create supplier account <ArrowRight size={15} /></Link></div> : marketplaceRole !== "supplier" ? <div className="form-panel empty-state"><div className="empty-state-icon"><ShieldCheck size={22} /></div><h3>A supplier account is required</h3><p>This buyer account cannot register a business. Use a different email to create a dedicated supplier account.</p><Link className="button button-primary" href="/register">Create supplier account <ArrowRight size={15} /></Link></div> : (
          <div className="form-panel">
            {params.applied ? <div className="notice success-notice" role="status"><div><strong>Application submitted.</strong><p>Your business is pending review. Supplier features unlock after approval.</p></div></div> : null}
            {params.error ? <div className="notice error-notice" role="alert"><div><strong>{params.error === "invalid" ? "A required detail needs attention." : "We couldn’t submit the application."}</strong><p>{params.error === "slug" ? "That business link is already taken. Change the shareable link and try again." : params.error === "role" ? "A supplier account approved by StockSOS is required before registering a business." : params.error === "invalid" ? `Check the ${fieldLabels[params.field ?? ""] ?? "business details"} and try again.` : "The application could not be saved. Please try again; if it continues, contact StockSOS support."}</p></div></div> : null}
            <div className="auth-panel">
              <form action={createBusinessApplicationAction}>
                <BusinessLinkFields />
                <div className="form-field"><label htmlFor="category_id">Main business category</label><select id="category_id" name="category_id" required defaultValue=""><option value="" disabled>Select a category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div>
                <GlobalLocationFields includeAddress={false} description="Used for global discovery and local supplier matching." />
                <div className="form-grid">
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
