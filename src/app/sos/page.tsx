import Link from "next/link";
import { ArrowRight, CircleAlert, Zap } from "lucide-react";
import { createSOSAction } from "@/app/actions";
import { getAuthenticatedUser } from "@/lib/auth";
import { getCategories } from "@/lib/data";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { VoiceTextField } from "@/components/voice-text-field";

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
          <div className="form-panel">
            {params.error ? <div className="notice error-notice" role="alert"><div><strong>We couldn’t submit that request.</strong><p>Check the details and try again.</p></div></div> : null}
            <div className="auth-panel">
              <form action={createSOSAction}>
                <div className="form-grid">
                  <div className="form-field"><label htmlFor="product_name">What do you need?</label><VoiceTextField id="product_name" name="product_name" required maxLength={180} placeholder="e.g. 12 mm plywood sheets" /></div>
                  <div className="form-field"><label htmlFor="category_id">Category</label><select id="category_id" name="category_id" required defaultValue=""><option value="" disabled>Select a category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div>
                </div>
                <div className="form-grid">
                  <div className="form-field"><label htmlFor="quantity">Quantity</label><input id="quantity" name="quantity" type="number" min="1" max="1000000" required placeholder="How many?" /></div>
                  <div className="form-field"><label htmlFor="condition">Preferred condition</label><select id="condition" name="condition" defaultValue="any"><option value="any">Any condition</option><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></div>
                </div>
                <div className="form-field"><label htmlFor="specifications">Specifications <span className="muted">(optional)</span></label><textarea id="specifications" name="specifications" maxLength={1000} placeholder="Brand, size, model or other details that help suppliers identify the item" /></div>
                <div className="form-grid">
                  <div className="form-field"><label htmlFor="city">City</label><input id="city" name="city" required minLength={2} maxLength={100} placeholder="Ibadan" /></div>
                  <div className="form-field"><label htmlFor="area">Area <span className="muted">(optional)</span></label><input id="area" name="area" maxLength={100} placeholder="Neighbourhood or market" /></div>
                </div>
                <div className="form-grid">
                  <div className="form-field"><label htmlFor="delivery_method">Pickup or delivery</label><select id="delivery_method" name="delivery_method" defaultValue="flexible"><option value="flexible">I’m flexible</option><option value="pickup">I can pick up</option><option value="delivery">I need delivery</option></select></div>
                  <div className="form-field"><label htmlFor="urgency">When do you need it?</label><select id="urgency" name="urgency" defaultValue="today"><option value="immediately">Immediately</option><option value="within_30_minutes">Within 30 minutes</option><option value="within_2_hours">Within 2 hours</option><option value="today">Today</option><option value="scheduled">Scheduled</option></select></div>
                </div>
                <div className="form-field"><label htmlFor="scheduled_at">Scheduled date <span className="muted">(if scheduled)</span></label><input id="scheduled_at" name="scheduled_at" type="datetime-local" /></div>
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
