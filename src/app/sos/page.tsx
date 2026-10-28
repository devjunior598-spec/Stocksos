import Link from "next/link";
import { ArrowRight, CircleAlert, Zap } from "lucide-react";
import { createSOSAction } from "@/app/actions";
import { getAuthenticatedUser } from "@/lib/auth";
import { getCategories } from "@/lib/data";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { VoiceTextField } from "@/components/voice-text-field";
import { GlobalLocationFields } from "@/components/global-location-fields";
import { SOSFulfilmentFields } from "@/components/sos-fulfilment-fields";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function SOSPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await getAuthenticatedUser();
  const categories = await getCategories();
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return (
    <>
      <section className="page-hero"><div className="page-container"><span className="eyebrow"><Zap size={14} /> SOS Now</span><h1>Tell suppliers what your business needs.</h1><p className="lead">Share the product, quantity, location and timing preference. Matched suppliers can respond with a quotation.</p><p className="metric-note"><CircleAlert size={14} /> Urgency is your preference, not a delivery guarantee.</p></div></section>
      <section className="page-container">
        {!configured ? <div className="form-panel"><SupabaseSetupNotice /></div> : !user ? <div className="form-panel empty-state"><div className="empty-state-icon"><Zap size={22} /></div><h3>Sign in to send a request</h3><p>Your request stays connected to your account so you can compare offers and track any resulting order.</p><Link className="button button-primary" href="/login?next=/sos">Log in to continue <ArrowRight size={15} /></Link></div> : (
          <div className="form-panel sos-form-panel">
            {params.error ? <div className="notice error-notice" role="alert"><div><strong>We couldn’t submit that request.</strong><p>Check the details and try again.</p></div></div> : null}
            <div className="auth-panel">
              <form action={createSOSAction}>
                <div className="form-section-heading"><span>Product details</span><small>Describe what your business needs.</small></div>
                <div className="form-grid">
                  <div className="form-field"><label htmlFor="product_name">What do you need?</label><VoiceTextField id="product_name" name="product_name" required maxLength={180} placeholder="e.g. 12 mm plywood sheets" /></div>
                  <div className="form-field"><label htmlFor="category_id">Category</label><select id="category_id" name="category_id" required defaultValue=""><option value="" disabled>Select a category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div>
                </div>
                <div className="form-grid">
                  <div className="form-field"><label htmlFor="quantity">Quantity</label><input id="quantity" name="quantity" type="number" min="1" max="1000000" required placeholder="How many?" /></div>
                  <div className="form-field"><label htmlFor="condition">Preferred condition</label><select id="condition" name="condition" defaultValue="any"><option value="any">Any condition</option><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></div>
                </div>
                <div className="form-field"><label htmlFor="specifications">Specifications <span className="muted">(optional)</span></label><textarea id="specifications" name="specifications" maxLength={1000} placeholder="Brand, size, model or other details that help suppliers identify the item" /></div>
                <GlobalLocationFields />
                <SOSFulfilmentFields />
                <div className="form-field"><label htmlFor="notes">Additional notes <span className="muted">(optional)</span></label><textarea id="notes" name="notes" maxLength={1000} placeholder="Anything else a supplier should know?" /></div>
                <button className="button button-primary form-submit" type="submit"><Zap size={16} /> Send SOS request</button>
                <p className="form-hint" style={{ textAlign: "center", marginTop: 12 }}>Your phone number and email are not broadcast to suppliers with the request.</p>
              </form>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
