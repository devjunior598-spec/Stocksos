import Link from "next/link";
import { ArrowLeft, ArrowRight, PackageSearch } from "lucide-react";
import { submitQuotationAction } from "@/app/actions";
import { requireSupplier } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Request = {
  id: string;
  category_id: string;
  product_name: string;
  quantity: number;
  city: string;
  area: string | null;
  urgency: string;
  specifications: string | null;
};

export default async function SupplierRequestsPage({ searchParams }: { searchParams: Promise<{ quote?: string; error?: string }> }) {
  const user = await requireSupplier();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const membershipsResult = await supabase!.from("business_memberships").select("business_id,businesses(id,name,verification_status)").eq("user_id", user.id);
  const memberships = (membershipsResult.data ?? []) as unknown as { business_id: string; businesses: { id: string; name: string; verification_status: string } | { id: string; name: string; verification_status: string }[] | null }[];
  const businesses = memberships.map((row) => Array.isArray(row.businesses) ? row.businesses[0] : row.businesses).filter((business): business is NonNullable<typeof business> => Boolean(business && business.verification_status === "approved"));
  const businessIds = businesses.map((business) => business.id);
  const [matchesResult, productsResult] = businessIds.length ? await Promise.all([
    supabase!.from("supplier_matches").select("id,business_id,match_score,sos_requests!inner(id,category_id,product_name,quantity,city,area,urgency,specifications,status)").in("business_id", businessIds).eq("status", "matched").limit(50),
    supabase!.from("products").select("id,business_id,name,category_id,is_active").in("business_id", businessIds).eq("is_active", true).limit(100),
  ]) : [{ data: [] }, { data: [] }];
  const matches = (matchesResult.data ?? []) as unknown as { id: string; business_id: string; match_score: number; sos_requests: Request | Request[] | null }[];
  const products = (productsResult.data ?? []) as { id: string; business_id: string; name: string; category_id: string; is_active: boolean }[];

  return <section className="supplier-marketplace-page"><div className="page-container supplier-requests-page">
    <Link className="text-link marketplace-back" href="/supplier"><ArrowLeft size={15} /> Supplier workspace</Link>
    <div className="marketplace-page-heading"><div><span className="eyebrow"><PackageSearch size={14} /> Matched requests</span><h1>Respond to buyers who need your stock.</h1><p className="lead">Each request is matched using your approved business, product category, availability, and delivery area.</p></div></div>
    {params.quote ? <div className="notice success-notice" role="status"><div><strong>Quotation sent.</strong><p>The buyer can now compare your offer.</p></div></div> : null}
    {params.error ? <div className="notice error-notice" role="alert"><div><strong>We couldn’t send that quotation.</strong><p>Check the price, quantity, and request details, then try again.</p></div></div> : null}
    <section className="supplier-request-list supplier-requests-panel">{matches.length ? matches.map((match) => {
      const request = Array.isArray(match.sos_requests) ? match.sos_requests[0] : match.sos_requests;
      const business = businesses.find((item) => item.id === match.business_id);
      if (!request || !business) return null;
      const productOptions = products.filter((product) => product.business_id === business.id && product.category_id === request.category_id);
      return <article className="supplier-request panel" key={match.id}><div className="request-summary-head"><div><span className="pill pill-orange">{request.urgency.replaceAll("_", " ")}</span><h2>{request.product_name}</h2><p className="muted small">{request.quantity} requested · {[request.area, request.city].filter(Boolean).join(", ")}</p></div><span className="pill">{match.match_score >= 100 ? "Local match" : "Expanded match"}</span></div>{request.specifications ? <p className="request-specs">{request.specifications}</p> : null}
        <form className="quote-form" action={submitQuotationAction}><input type="hidden" name="request_id" value={request.id} /><input type="hidden" name="business_id" value={business.id} /><input type="hidden" name="return_to" value="/supplier/requests" />
          <div className="form-grid"><div className="form-field"><label htmlFor={`price-${match.id}`}>Unit price (USD)</label><input id={`price-${match.id}`} name="price" type="number" min="0.01" step="0.01" required /></div><div className="form-field"><label htmlFor={`quantity-${match.id}`}>Quantity offered</label><input id={`quantity-${match.id}`} name="quantity" type="number" min="1" max="1000000" defaultValue={request.quantity} required /></div></div>
          <div className="form-grid"><div className="form-field"><label htmlFor={`product-${match.id}`}>Inventory listing <span className="muted">(optional)</span></label><select id={`product-${match.id}`} name="product_id" defaultValue=""><option value="">Manual availability confirmation</option>{productOptions.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div><div className="form-field"><label htmlFor={`fee-${match.id}`}>Delivery fee (USD)</label><input id={`fee-${match.id}`} name="delivery_fee" type="number" min="0" step="0.01" defaultValue="0" /></div></div>
          <div className="form-grid"><div className="form-field"><label htmlFor={`delivery-${match.id}`}>Can you deliver?</label><select id={`delivery-${match.id}`} name="delivery_available" defaultValue="no"><option value="no">Pickup only</option><option value="yes">Delivery available</option></select></div><div className="form-field"><label htmlFor={`prep-${match.id}`}>Preparation time (minutes)</label><input id={`prep-${match.id}`} name="preparation_minutes" type="number" min="0" max="10080" /></div></div>
          <div className="form-field"><label htmlFor={`note-${match.id}`}>Offer note <span className="muted">(optional)</span></label><input id={`note-${match.id}`} name="note" maxLength={500} placeholder="Condition, pickup details, or product match" /></div><button className="button button-primary button-small" type="submit">Send quotation <ArrowRight size={14} /></button>
        </form>
      </article>;
    }) : <div className="panel marketplace-empty"><PackageSearch size={26} /><h2>No matched requests</h2><p>When a buyer needs stock that matches your approved business and categories, it will appear here.</p><Link className="button button-secondary" href="/supplier/marketplace">Review products</Link></div>}</section>
  </div></section>;
}
