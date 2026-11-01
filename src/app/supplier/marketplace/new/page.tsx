import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Globe2, ImagePlus, PackagePlus, ShieldCheck, Store } from "lucide-react";
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
  const businesses = memberships.map((row) => Array.isArray(row.businesses) ? row.businesses[0] : row.businesses)
    .filter((business): business is NonNullable<typeof business> => Boolean(business));
  const manageable = memberships.filter((row) => ["owner", "admin", "inventory"].includes(row.role))
    .map((row) => row.business_id)
    .filter((id) => businesses.some((business) => business.id === id && business.verification_status === "approved"));

  return <section className="supplier-marketplace-page">
    <div className="page-container new-product-page">
      <Link className="text-link marketplace-back" href="/supplier/marketplace"><ArrowLeft size={15} /> All products</Link>
      <div className="new-product-heading">
        <div><span className="eyebrow"><PackagePlus size={14} /> Create a listing</span><h1>Give buyers the details they need.</h1><p className="lead">Add accurate product, stock, price, and media details. Buyers can then understand your offer before they contact you.</p></div>
        <div className="new-product-tips"><ImagePlus size={17} /><span>Clear photos, specific descriptions, and current stock make a listing more useful.</span></div>
      </div>
      {params.error ? <div className="notice error-notice" role="alert"><div><strong>We couldn’t publish your product.</strong><p>Check the required details and price. If you added photos or video, confirm the upload finished, then submit again.</p></div></div> : null}
      {manageable.length ? <>
        <ol className="new-product-steps" aria-label="Listing setup steps">
          <li><span>1</span> Product details</li><li><span>2</span> Price and stock</li><li><span>3</span> Photos and video</li><li><span>4</span> Review and publish</li>
        </ol>
        <div className="new-product-layout">
          <form action={createSupplierProductAction} className="new-product-form panel">
            <input type="hidden" name="return_to" value="/supplier/marketplace/new" />
            <section>
              <div className="new-product-section-heading"><span>01</span><div><h2>Product details</h2><p>Start with a clear name and the right category so buyers can find your item.</p></div></div>
              <div className="form-field"><label htmlFor="business_id">Business</label><select id="business_id" name="business_id" required>{manageable.map((id) => <option value={id} key={id}>{businesses.find((business) => business.id === id)?.name}</option>)}</select><span className="form-hint">Choose which approved storefront will offer this product.</span></div>
              <div className="form-grid"><div className="form-field"><label htmlFor="category_id">Product category</label><select id="category_id" name="category_id" required defaultValue=""><option value="" disabled>Select a category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div><div className="form-field"><label htmlFor="name">Product name</label><input id="name" name="name" required minLength={2} maxLength={180} placeholder="e.g. 500 ml insulated steel bottle" /></div></div>
              <div className="form-grid"><div className="form-field"><label htmlFor="brand">Brand <span className="muted">(optional)</span></label><input id="brand" name="brand" maxLength={120} placeholder="Brand or manufacturer" /></div><div className="form-field"><label htmlFor="sku">SKU or item code <span className="muted">(optional)</span></label><input id="sku" name="sku" maxLength={80} placeholder="Your internal reference" /></div></div>
            </section>
            <section>
              <div className="new-product-section-heading"><span>02</span><div><h2>Price and availability</h2><p>Show buyers the price, how the item is sold, and when it can be ready.</p></div></div>
              <div className="form-grid"><div className="form-field"><label htmlFor="price">Price per unit (USD)</label><input id="price" name="price" type="number" min="0" step="0.01" required placeholder="0.00" /><span className="form-hint">Enter the price for one unit or package.</span></div><div className="form-field"><label htmlFor="quantity">Available quantity</label><input id="quantity" name="quantity" type="number" min="0" max="1000000" required placeholder="e.g. 120" /><span className="form-hint">Keep this updated as stock changes.</span></div></div>
              <div className="form-grid"><div className="form-field"><label htmlFor="unit">Sold by <span className="muted">(optional)</span></label><input id="unit" name="unit" maxLength={40} placeholder="each, carton of 24, pallet" /></div><div className="form-field"><label htmlFor="minimum_order">Minimum order <span className="muted">(optional)</span></label><input id="minimum_order" name="minimum_order" maxLength={60} placeholder="e.g. 12 units" /></div></div>
              <div className="form-grid"><div className="form-field"><label htmlFor="lead_time">Ready or lead time <span className="muted">(optional)</span></label><input id="lead_time" name="lead_time" maxLength={80} placeholder="e.g. Ready today or 3–5 days" /></div><div className="form-field"><label htmlFor="condition">Product condition</label><select id="condition" name="condition"><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></div></div>
              <div className="form-field"><label htmlFor="visibility">Listing visibility</label><select id="visibility" name="visibility"><option value="public">Public marketplace — buyers can discover it</option><option value="private">Private — only visible in my workspace</option></select></div>
            </section>
            <section>
              <div className="new-product-section-heading"><span>03</span><div><h2>Photos and video</h2><p>Add images that show the product clearly. A short video can demonstrate use or packaging.</p></div></div>
              <InventoryImageField id="new-product-media" />
            </section>
            <section>
              <div className="new-product-section-heading"><span>04</span><div><h2>Description and specifications</h2><p>Help buyers decide whether the item fits their needs.</p></div></div>
              <div className="form-field"><label htmlFor="specifications">Product description <span className="muted">(optional)</span></label><textarea id="specifications" name="specifications" maxLength={650} placeholder="Add material, dimensions, color, compatibility, packaging, or other details a buyer should know." /><span className="form-hint">Avoid adding personal or confidential information.</span></div>
            </section>
            <div className="new-product-actions"><Link className="button button-secondary" href="/supplier/marketplace">Cancel</Link><button className="button button-primary" type="submit"><Globe2 size={15} /> Publish product <ArrowRight size={14} /></button></div>
          </form>
          <aside className="new-product-guide">
            <section className="panel new-product-guide-card"><span className="new-product-guide-icon"><Store size={18} /></span><h2>Make your listing useful</h2><p>Buyers compare details before choosing a supplier. A complete listing makes that easier.</p><ul><li><Check size={14} /> Use the product’s common name</li><li><Check size={14} /> Add the category and brand</li><li><Check size={14} /> State the unit and minimum order</li><li><Check size={14} /> Keep price and stock accurate</li><li><Check size={14} /> Add clear photos when available</li></ul></section>
            <section className="panel new-product-visibility-card"><ShieldCheck size={18} /><div><h3>You control visibility</h3><p>Public listings can appear in StockSOS product discovery. Private listings stay in your workspace.</p></div></section>
          </aside>
        </div>
      </> : <div className="panel marketplace-empty"><Store size={25} /><h2>You need an approved supplier business.</h2><p>Ask a business owner or administrator to grant inventory access before creating a listing.</p><Link className="button button-primary" href="/supplier">Return to workspace</Link></div>}
    </div>
  </section>;
}
