import Link from "next/link";
import { ArrowLeft, Globe2, ImagePlus, PackagePlus, Store, Video } from "lucide-react";
import { createSupplierProductAction } from "@/app/actions";
import { requireSupplier } from "@/lib/auth";
import { getCategories } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InventoryImageField } from "@/components/inventory-image-field";

export const dynamic = "force-dynamic";

export default async function NewSupplierProductPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireSupplier();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [membershipsResult, categories] = await Promise.all([
    supabase!.from("business_memberships").select("business_id,role,businesses(id,name,verification_status)").eq("user_id", user.id),
    getCategories(),
  ]);
  const memberships = (membershipsResult.data ?? []) as unknown as { business_id: string; role: string; businesses: { id: string; name: string; verification_status: string } | { id: string; name: string; verification_status: string }[] | null }[];
  const businesses = memberships.map((row) => Array.isArray(row.businesses) ? row.businesses[0] : row.businesses).filter((business): business is NonNullable<typeof business> => Boolean(business));
  const manageable = memberships.filter((row) => ["owner", "admin", "inventory"].includes(row.role)).map((row) => row.business_id).filter((id) => businesses.some((business) => business.id === id && business.verification_status === "approved"));

  return <section className="supplier-marketplace-page">
    <div className="page-container new-product-page">
      <Link className="text-link marketplace-back" href="/supplier/marketplace"><ArrowLeft size={15} /> All products</Link>
      <div className="new-product-heading"><div><span className="eyebrow"><PackagePlus size={14} /> New product</span><h1>Tell buyers exactly what you have.</h1><p className="lead">Strong product information makes your listing easier to find and quicker to buy.</p></div><div className="new-product-tips"><ImagePlus size={17} /><span>Use clear photos, include a short video if it helps, and keep stock and price current.</span></div></div>
      {params.error ? <div className="notice error-notice" role="alert"><div><strong>We couldn’t publish that product yet.</strong><p>Check the required fields, price, and uploaded media, then try again.</p></div></div> : null}
      {manageable.length ? <form action={createSupplierProductAction} className="new-product-form panel"><input type="hidden" name="return_to" value="/supplier/marketplace/new" />
        <section><h2>1. Product basics</h2><div className="form-grid"><div className="form-field"><label htmlFor="business_id">Business</label><select id="business_id" name="business_id" required>{manageable.map((id) => <option value={id} key={id}>{businesses.find((business) => business.id === id)?.name}</option>)}</select></div><div className="form-field"><label htmlFor="category_id">Category</label><select id="category_id" name="category_id" required defaultValue=""><option value="" disabled>Select a category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div></div><div className="form-grid"><div className="form-field"><label htmlFor="name">Product name</label><input id="name" name="name" required minLength={2} maxLength={180} placeholder="e.g. 500 ml insulated steel bottle" /></div><div className="form-field"><label htmlFor="brand">Brand <span className="muted">(optional)</span></label><input id="brand" name="brand" maxLength={120} placeholder="Brand or manufacturer" /></div></div><div className="form-grid"><div className="form-field"><label htmlFor="sku">SKU / item code <span className="muted">(optional)</span></label><input id="sku" name="sku" maxLength={80} placeholder="e.g. BTL-500-SS" /></div><div className="form-field"><label htmlFor="unit">Sold by <span className="muted">(optional)</span></label><input id="unit" name="unit" maxLength={40} placeholder="each, carton of 24, pallet" /></div></div></section>
        <section><h2>2. Price & availability</h2><div className="form-grid"><div className="form-field"><label htmlFor="quantity">Quantity available</label><input id="quantity" name="quantity" type="number" min="0" max="1000000" required placeholder="0" /></div><div className="form-field"><label htmlFor="price">Unit price (USD)</label><input id="price" name="price" type="number" min="0" step="0.01" required placeholder="0.00" /></div></div><div className="form-grid"><div className="form-field"><label htmlFor="minimum_order">Minimum order <span className="muted">(optional)</span></label><input id="minimum_order" name="minimum_order" maxLength={60} placeholder="e.g. 12 units" /></div><div className="form-field"><label htmlFor="lead_time">Lead time <span className="muted">(optional)</span></label><input id="lead_time" name="lead_time" maxLength={80} placeholder="e.g. Ready today" /></div></div><div className="form-grid"><div className="form-field"><label htmlFor="condition">Condition</label><select id="condition" name="condition"><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></div><div className="form-field"><label htmlFor="visibility">Who can see it?</label><select id="visibility" name="visibility"><option value="public">Public marketplace</option><option value="private">Only my workspace</option></select></div></div></section>
        <section><h2>3. Photos & video</h2><p className="muted small">Show the product from more than one angle. Add a video for a demo, dimensions, or packaging details.</p><InventoryImageField id="new-product-media" /></section>
        <section><h2>4. Buyer details</h2><div className="form-field"><label htmlFor="specifications">Description & specifications <span className="muted">(optional)</span></label><textarea id="specifications" name="specifications" maxLength={650} placeholder="Include material, size, color, compatibility, packaging, or other buying details." /></div></section>
        <div className="new-product-actions"><Link className="button button-secondary" href="/supplier/marketplace">Cancel</Link><button className="button button-primary" type="submit"><Globe2 size={15} /> Publish product</button></div>
      </form> : <div className="panel marketplace-empty"><Store size={25} /><h2>You need an approved supplier business.</h2><p>Ask a business owner or administrator to grant inventory access before creating a listing.</p><Link className="button button-primary" href="/supplier">Return to workspace</Link></div>}
    </div>
  </section>;
}
