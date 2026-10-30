import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck, Building2, Boxes, MapPin, PackageSearch, Share2 } from "lucide-react";
import { createBusinessEnquiryAction, saveSupplierAction, updateBusinessEnquiryStatusAction } from "@/app/actions";
import { getAuthenticatedUser } from "@/lib/auth";
import { formatNaira, getMarketplaceImageUrl } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ enquiry?: string; error?: string; updated?: string; saved?: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<import("next").Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return {};
  const { data } = await supabase.from("businesses").select("name,city,description").eq("slug", slug).eq("verification_status", "approved").eq("visibility", "public").maybeSingle();
  if (!data) return {};
  const description = data.description || `Browse verified inventory from ${data.name} in ${data.city}.`;
  return { title: `${data.name} supplier storefront`, description, alternates: { canonical: `/business/${slug}` }, openGraph: { title: `${data.name} · StockSOS`, description, type: "website" } };
}

export default async function BusinessProfilePage({ params, searchParams }: Props) {
  const [{ slug }, query, user] = await Promise.all([params, searchParams, getAuthenticatedUser()]);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <section className="page-container section-tight"><SupabaseSetupNotice /></section>;

  const { data: business } = await supabase.from("businesses")
    .select("id,name,slug,city,area,description,primary_category_id,categories(name)")
    .eq("slug", slug).eq("verification_status", "approved").eq("visibility", "public").maybeSingle();
  if (!business) notFound();

  const [{ data: products }, membershipResult, savedResult] = await Promise.all([
    supabase.from("products")
      .select("id,name,brand,condition,specifications,image_path,category_id,inventory!inner(quantity_available,unit_price_kobo,currency)")
      .eq("business_id", business.id).eq("is_active", true).eq("visibility", "public")
      .gt("inventory.quantity_available", 0).order("created_at", { ascending: false }).limit(30),
    user ? supabase.from("business_memberships").select("role").eq("business_id", business.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("saved_suppliers").select("business_id").eq("business_id", business.id).eq("buyer_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const isMember = Boolean(membershipResult.data && ["owner", "admin"].includes(membershipResult.data.role));
  const isSaved = Boolean(savedResult.data);
  const { data: enquiries } = isMember
    ? await supabase.from("business_enquiries").select("id,requester_id,product_name,quantity,consent_to_referral,status,created_at")
      .eq("business_id", business.id).order("created_at", { ascending: false }).limit(20)
    : { data: [] };
  const businessCategory = Array.isArray(business.categories) ? business.categories[0] : business.categories;

  return <>
    <section className="page-hero"><div className="page-container business-hero">
      <span className="eyebrow"><BadgeCheck size={14} /> Verified business profile</span>
      <div className="business-profile-heading"><span className="business-avatar"><Building2 size={25} /></span><div><h1>{business.name}</h1><p className="lead"><MapPin size={15} /> {[business.area, business.city].filter(Boolean).join(", ")} · {businessCategory?.name ?? "StockSOS supplier"}</p></div></div>
      {business.description ? <p className="business-description">{business.description}</p> : null}
      <div className="business-profile-actions"><Link className="button button-secondary" href="/suppliers"><ArrowRight size={15} /> All suppliers</Link>{user && !isMember ? <form action={saveSupplierAction}><input type="hidden" name="business_id" value={business.id} /><input type="hidden" name="slug" value={business.slug} /><input type="hidden" name="intent" value={isSaved ? "remove" : "save"} /><button className="button button-quiet" type="submit">{isSaved ? "Remove saved supplier" : "Save supplier"}</button></form> : null}<span className="share-link"><Share2 size={14} /> stocksos.ng/business/{business.slug}</span></div>
    </div></section>
    <section className="section-tight"><div className="page-container">
      {query.enquiry ? <div className="notice success-notice enquiry-notice"><BadgeCheck size={17} /><div><strong>Enquiry sent.</strong><p>The business has been notified. Your contact details stay private unless you approve a referral.</p></div></div> : null}
      {query.saved ? <div className="notice success-notice enquiry-notice"><div><strong>{query.saved === "1" ? "Supplier saved." : "Supplier removed from your saved list."}</strong></div></div> : null}
      {query.error ? <div className="notice error-notice enquiry-notice"><div><strong>We couldn’t send the enquiry.</strong><p>Check the form and try again in a moment.</p></div></div> : null}
      {query.updated ? <div className="notice success-notice enquiry-notice"><div><strong>Enquiry status updated.</strong></div></div> : null}
      <div className="business-profile-grid">
        <div>
          <div className="dashboard-section-head"><h2>Available stock</h2><span className="muted small">Live listings with available inventory</span></div>
          {products?.length ? <div className="catalog-grid">{products.map((product) => {
            const stock = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
            const imageUrl = getMarketplaceImageUrl(product.image_path);
            return <article className="product-card" key={product.id}><div className="product-placeholder">{imageUrl ? <Image src={imageUrl} alt={product.name} fill unoptimized sizes="(max-width: 700px) 100vw, (max-width: 1050px) 50vw, 33vw" className="product-image" /> : <PackageSearch size={25} />}</div><div className="product-detail"><span className="pill">{product.condition}</span><h3>{product.name}</h3><p>{[product.brand, `${stock?.quantity_available ?? 0} available`].filter(Boolean).join(" · ")}</p>{product.specifications ? <p className="product-specs">{product.specifications}</p> : null}<div className="product-price">{formatNaira(stock?.unit_price_kobo)}</div><Link className="text-link" href={`/product/${product.id}`}>View product <ArrowRight size={14} /></Link></div></article>;
          })}</div> : <div className="empty-state"><div className="empty-state-icon"><Boxes size={21} /></div><h3>No public stock listed yet</h3><p>This approved business has not published available inventory. You can still send a product enquiry below.</p></div>}
        </div>
        <aside>
          <section className="panel dashboard-section"><span className="eyebrow">SOS Link</span><h2>Ask about stock</h2><p className="muted small">Tell this business what you need. If it is unavailable, they can source it or refer you only with your consent.</p>
            {!user ? <Link className="button button-primary form-submit" href={"/login?next=" + encodeURIComponent("/business/" + business.slug)}>Sign in to send an enquiry <ArrowRight size={14} /></Link> : <form action={createBusinessEnquiryAction}>
              <input type="hidden" name="business_id" value={business.id} />
              <div className="form-field"><label htmlFor="product_name">Product</label><input id="product_name" name="product_name" required minLength={2} maxLength={180} placeholder="What are you looking for?" /></div>
              <div className="form-field"><label htmlFor="quantity">Quantity</label><input id="quantity" name="quantity" type="number" min="1" max="1000000" defaultValue="1" required /></div>
              <label className="consent-line"><input type="checkbox" name="consent_to_referral" value="yes" /> I agree this business may refer me to another supplier for this request.</label>
              <button className="button button-primary form-submit" type="submit">Send product enquiry <ArrowRight size={14} /></button>
              <p className="form-hint">Your phone number and email are not shared with the supplier through this enquiry.</p>
            </form>}
          </section>
        </aside>
      </div>
      {isMember ? <section className="panel dashboard-section enquiry-management"><div className="dashboard-section-head"><h2>Incoming enquiries</h2><span className="muted small">Visible to this business’s owners and admins</span></div>
        {enquiries?.length ? <div className="order-list">{enquiries.map((enquiry) => <div className="order-row enquiry-row" key={enquiry.id}><span className="order-icon"><PackageSearch size={17} /></span><span className="order-copy"><strong>{enquiry.product_name} · {enquiry.quantity}</strong><small>{new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(enquiry.created_at))} · {enquiry.consent_to_referral ? "Referral consent given" : "No referral consent"}</small></span><span className="pill">{enquiry.status}</span>{enquiry.status === "new" ? <form action={updateBusinessEnquiryStatusAction}><input type="hidden" name="enquiry_id" value={enquiry.id} /><input type="hidden" name="status" value="sourcing" /><button className="button button-secondary button-small" type="submit">Start sourcing</button></form> : null}{enquiry.consent_to_referral && enquiry.status !== "referred" && enquiry.status !== "closed" ? <form action={updateBusinessEnquiryStatusAction}><input type="hidden" name="enquiry_id" value={enquiry.id} /><input type="hidden" name="status" value="referred" /><button className="button button-secondary button-small" type="submit">Mark referred</button></form> : null}{enquiry.status !== "closed" ? <form action={updateBusinessEnquiryStatusAction}><input type="hidden" name="enquiry_id" value={enquiry.id} /><input type="hidden" name="status" value="closed" /><button className="text-link small" type="submit">Close</button></form> : null}</div>)}</div> : <p className="muted small">New enquiries will appear here when customers use this share link.</p>}
      </section> : null}
    </div></section>
  </>;
}
