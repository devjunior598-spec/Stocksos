import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, CircleCheck, Globe2, LockKeyhole, MapPin, PackageSearch, ShieldCheck, Store, Truck } from "lucide-react";
import { createBusinessApplicationAction } from "@/app/actions";
import { getAuthenticatedUser, getMarketplaceRole } from "@/lib/auth";
import { getCategories } from "@/lib/data";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { GlobalLocationFields } from "@/components/global-location-fields";
import { BusinessLinkFields } from "@/components/business-link-fields";
import { BusinessLogoUpload } from "@/components/business-logo-upload";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readSignupProfile } from "@/lib/signup-profile";

type Props = { searchParams: Promise<{ error?: string; applied?: string; field?: string }> };

const fieldLabels: Record<string, string> = {
  name: "business name", slug: "shareable business link", categoryId: "business category", logo: "business logo or photo",
  country: "country", region: "state or region", city: "city", email: "business email",
};

export default async function BecomeSupplierPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await getAuthenticatedUser();
  const marketplaceRole = user ? await getMarketplaceRole(user.id) : null;
  const supabase = user ? await createSupabaseServerClient() : null;
  const [authData, profileData] = user && supabase ? await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("home_country,home_region,home_city,home_postal_code,home_area").eq("id", user.id).maybeSingle(),
  ]) : [null, null];
  const signupDraft = readSignupProfile(authData?.data.user?.user_metadata?.signup_profile);
  const savedLocation = profileData?.data;
  const categories = await getCategories();
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return (
    <>
      <section className="page-hero"><div className="page-container"><span className="eyebrow"><Building2 size={14} /> Your supplier profile</span><h1>Set up your business for discovery.</h1><p className="lead">Give buyers the details they need to find your business, understand what you supply, and request a quotation. You can manage products from your supplier workspace.</p></div></section>
      <section className="page-container">
        {!configured ? <div className="form-panel"><SupabaseSetupNotice /></div> : !user ? <div className="form-panel empty-state"><div className="empty-state-icon"><ShieldCheck size={22} /></div><h3>Create a supplier account first</h3><p>Business applications are tied to a verified supplier account.</p><Link className="button button-primary" href="/register">Create supplier account <ArrowRight size={15} /></Link></div> : marketplaceRole !== "supplier" ? <div className="form-panel empty-state"><div className="empty-state-icon"><ShieldCheck size={22} /></div><h3>A supplier account is required</h3><p>This buyer account cannot register a business. Use a different email to create a dedicated supplier account.</p><Link className="button button-primary" href="/register">Create supplier account <ArrowRight size={15} /></Link></div> : (
          <div className="business-application-layout">
            {params.applied ? <div className="notice success-notice" role="status"><div><strong>Application submitted.</strong><p>Your business is pending review. Supplier features unlock after approval.</p></div></div> : null}
            {params.error ? <div className="notice error-notice" role="alert"><div><strong>{params.error === "invalid" ? "A required detail needs attention." : "We couldn’t submit the application."}</strong><p>{params.error === "slug" ? "That business link is already taken. Change the shareable link and try again." : params.error === "role" ? "A supplier account approved by StockSOS is required before registering a business." : params.error === "logo" ? "Use a valid JPG, PNG or WebP business image no larger than 4 MB." : params.error === "invalid" ? `Check the ${fieldLabels[params.field ?? ""] ?? "business details"} and try again.` : "The application could not be saved. Please try again; if it continues, contact StockSOS support."}</p></div></div> : null}
            <div className="auth-panel business-application-form">
              <div className="business-form-intro"><span className="eyebrow">Business details</span><h2>Build a profile buyers can trust.</h2><p>Required details help StockSOS verify and match your business. You can add and manage your products after setup.</p></div>
              {signupDraft?.businessName ? <div className="notice"><div><strong>Your sign-up details are ready.</strong><p>Review the prefilled business and location fields, add any optional details, then submit this profile to create your storefront.</p></div></div> : null}
              <form action={createBusinessApplicationAction}>
                <section className="business-form-section" aria-labelledby="business-identity-heading">
                  <div className="form-section-heading"><span id="business-identity-heading">1. Business identity</span><small>How buyers recognize your company</small></div>
                  <BusinessLinkFields initialName={signupDraft?.businessName ?? ""} />
                  <BusinessLogoUpload />
                  <div className="form-field"><label htmlFor="category_id">Main business category</label><select id="category_id" name="category_id" required defaultValue={categories.some((category) => category.id === signupDraft?.businessCategoryId) ? signupDraft?.businessCategoryId : ""}><option value="" disabled>Select a category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select><span className="form-hint">Choose the category that best describes the products you plan to list.</span></div>
                </section>
                <GlobalLocationFields includeAddress={false} description="Used for global discovery and local supplier matching." defaults={{
                  country: savedLocation?.home_country ?? signupDraft?.country,
                  region: savedLocation?.home_region ?? signupDraft?.region,
                  city: savedLocation?.home_city ?? signupDraft?.city,
                  postalCode: savedLocation?.home_postal_code ?? signupDraft?.postalCode,
                  area: savedLocation?.home_area ?? signupDraft?.area,
                }} />
                <section className="business-form-section" aria-labelledby="business-contact-heading">
                  <div className="form-section-heading"><span id="business-contact-heading">3. Contact and business details</span><small>Helps StockSOS reach you about your account</small></div>
                  <div className="form-grid">
                    <div className="form-field"><label htmlFor="phone">Business phone <span className="muted">(optional)</span></label><input id="phone" name="phone" type="tel" maxLength={30} autoComplete="tel" placeholder="Include country calling code" defaultValue={user.signupPhone ?? ""} /></div>
                    <div className="form-field"><label htmlFor="email">Business email <span className="muted">(optional)</span></label><input id="email" name="email" type="email" autoComplete="email" placeholder="name@business.com" defaultValue={user.email ?? ""} /></div>
                  </div>
                  <div className="form-field"><label htmlFor="registration_number">Business registration number <span className="muted">(optional)</span></label><input id="registration_number" name="registration_number" maxLength={100} autoComplete="off" placeholder="Enter only if your business has one" /><span className="form-hint">Do not enter a personal identification number. This field is for your business registration reference.</span></div>
                  <div className="form-field"><label htmlFor="description">Business introduction <span className="muted">(optional)</span></label><textarea id="description" name="description" maxLength={1000} defaultValue={signupDraft?.businessDescription ?? ""} placeholder="What products do you supply? Who do you serve? What makes ordering from your business straightforward?" /><span className="form-hint">A clear, specific introduction helps buyers decide whether your business fits their needs. Up to 1,000 characters.</span></div>
                </section>
                <div className="notice"><BadgeCheck size={16} /><div><strong>Your profile is reviewed before it appears publicly.</strong><p>Only approved businesses and published listings are discoverable. Contact details and registration references are used for account operations and are not displayed on the public storefront.</p></div></div>
                <button className="button button-primary form-submit" type="submit">Submit business application <ArrowRight size={15} /></button>
                <p className="business-submit-note"><LockKeyhole size={13} /> Your profile details are saved to your supplier account.</p>
              </form>
            </div>
            <aside className="business-profile-guide" aria-label="Business profile guidance">
              <section className="panel business-preview-card">
                <span className="eyebrow"><Store size={13} /> Your StockSOS storefront</span>
                <h2>One profile. A clearer path to buyers.</h2>
                <p>Once your business is approved, this profile introduces your company and links buyers to the inventory you publish.</p>
                <div className="business-preview-sample"><span className="business-preview-mark"><Building2 size={20} /></span><div><strong>Your business name</strong><small><MapPin size={11} /> Your city · Your region · Your country</small></div><BadgeCheck size={16} className="business-preview-check" /></div>
                <div className="business-preview-links"><span><PackageSearch size={13} /> Public product listings</span><span><Truck size={13} /> Buyer enquiries and quotations</span></div>
              </section>
              <section className="panel business-profile-checklist">
                <div className="dashboard-section-head"><h2>What you’ll need</h2><CircleCheck size={17} /></div>
                <ul><li><CircleCheck size={14} /> Business name and share link</li><li><CircleCheck size={14} /> Product category and location</li><li><CircleCheck size={14} /> Optional business contact details</li><li><CircleCheck size={14} /> A short, helpful company introduction</li></ul>
                <div className="business-profile-private"><Globe2 size={15} /><p>Your business name, category, location, introduction and approved listings can appear publicly. Contact and registration details stay private.</p></div>
              </section>
            </aside>
          </div>
        )}
      </section>
    </>
  );
}
