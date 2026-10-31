import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgeCheck, Globe2, ImagePlus, PackagePlus, PackageSearch, Store, Video } from "lucide-react";
import { createSupplierProductAction, deleteSupplierProductAction, updateSupplierProductAction } from "@/app/actions";
import { requireSupplier } from "@/lib/auth";
import { formatMoney, getCategories, getMarketplaceImageUrl } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InventoryImageField } from "@/components/inventory-image-field";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ product?: string; error?: string; image?: string }> };

export default async function SupplierMarketplacePage({ searchParams }: Props) {
  const user = await requireSupplier();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const [membershipResult, categories] = await Promise.all([
    supabase!.from("business_memberships").select("business_id,role,businesses(id,name,slug,city,verification_status,visibility)").eq("user_id", user.id).order("created_at"),
    getCategories(),
  ]);
  const memberships = (membershipResult.data ?? []) as unknown as { business_id: string; role: string; businesses: { id: string; name: string; slug: string; city: string; verification_status: string; visibility: string } | { id: string; name: string; slug: string; city: string; verification_status: string; visibility: string }[] | null }[];
  const businesses = memberships.map((row) => Array.isArray(row.businesses) ? row.businesses[0] : row.businesses).filter((business): business is NonNullable<typeof business> => Boolean(business));
  const approvedIds = businesses.filter((business) => business.verification_status === "approved").map((business) => business.id);
  const productsResult = approvedIds.length ? await supabase!.from("products").select("id,business_id,name,brand,specifications,image_path,media_paths,category_id,condition,is_active,visibility,inventory(quantity_available,unit_price_kobo,currency)").in("business_id", approvedIds).order("created_at", { ascending: false }).limit(100) : { data: [] };
  const products = (productsResult.data ?? []) as unknown as { id: string; business_id: string; name: string; brand: string | null; specifications: string | null; image_path: string | null; media_paths: string[]; category_id: string; condition: string; is_active: boolean; visibility: string; inventory: { quantity_available: number; unit_price_kobo: number; currency: string } | { quantity_available: number; unit_price_kobo: number; currency: string }[] | null }[];
  const manageable = memberships.filter((row) => ["owner", "admin", "inventory"].includes(row.role)).map((row) => row.business_id).filter((id) => approvedIds.includes(id));

  return <section className="supplier-marketplace-page">
    <div className="page-container">
      <Link className="text-link marketplace-back" href="/supplier"><ArrowLeft size={15} /> Supplier workspace</Link>
      <div className="marketplace-page-heading"><div><span className="eyebrow"><Store size={14} /> Supplier marketplace</span><h1>Your products, ready to be discovered.</h1><p className="lead">Create polished listings with clear product photos, video, accurate availability and pricing.</p></div><div className="marketplace-page-count"><strong>{products.filter((item) => item.is_active).length}</strong><span>active listings</span></div></div>
      {params.product ? <div className="notice success-notice" role="status"><div><strong>{params.product === "created" ? "Product published." : params.product === "updated" ? "Product updated." : params.product === "deleted" ? "Product deleted." : params.product === "archived" ? "Listing archived." : "Product saved."}</strong><p>Your marketplace listing has been updated.</p></div></div> : null}
      {params.error ? <div className="notice error-notice" role="alert"><div><strong>We couldn’t save that listing.</strong><p>Check the product details and try again.</p></div></div> : null}
      {params.image === "error" ? <div className="notice error-notice" role="alert"><div><strong>Media could not be connected to this listing.</strong><p>Try adding the photo or video again.</p></div></div> : null}

      {!businesses.length ? <div className="panel marketplace-empty"><PackageSearch size={26} /><h2>Your supplier profile is not set up yet.</h2><p>Submit your business details before publishing products.</p><Link className="button button-primary" href="/become-supplier">Add your business <ArrowRight size={15} /></Link></div> : !approvedIds.length ? <div className="panel marketplace-empty"><BadgeCheck size={26} /><h2>Business approval is required before publishing.</h2><p>Once your supplier account is approved, your business storefront will be ready for product listings.</p></div> : (
        <div className="supplier-marketplace-grid">
          <div className="marketplace-listings">
            <div className="marketplace-subhead"><div><h2>Published and draft products</h2><p>Only active public listings appear on the StockSOS marketplace.</p></div><a className="text-link" href="#new-product"><PackagePlus size={15} /> Add product</a></div>
            {products.length ? <div className="supplier-product-grid">{products.map((product) => {
              const stock = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
              const business = businesses.find((item) => item.id === product.business_id);
              const imagePath = product.image_path ?? product.media_paths?.find((path) => /\.(jpg|png|webp)$/i.test(path)) ?? "";
              const imageUrl = getMarketplaceImageUrl(imagePath);
              const mediaCount = product.media_paths?.length ?? (imagePath ? 1 : 0);
              return <article className="supplier-product-card" key={product.id}>
                <Link className="supplier-product-photo" href={`/product/${product.id}`} aria-label={`Preview ${product.name}`}>
                  {imageUrl ? <Image src={imageUrl} alt={product.name} fill unoptimized sizes="(max-width: 720px) 100vw, 320px" /> : <PackageSearch size={30} />}
                  {product.media_paths?.some((path) => /\.(mp4|webm)$/i.test(path)) ? <span className="supplier-product-video-badge"><Video size={12} /> Video</span> : null}
                  <span className={`pill ${product.is_active && product.visibility === "public" ? "pill-green" : "pill-orange"}`}>{product.is_active && product.visibility === "public" ? "Live" : "Hidden"}</span>
                </Link>
                <div className="supplier-product-card-copy"><div className="supplier-product-card-top"><span>{business?.name}</span><span><ImagePlus size={12} /> {mediaCount}</span></div><h3>{product.name}</h3><p>{[product.brand, business?.city].filter(Boolean).join(" · ") || "Stock listing"}</p><div className="supplier-product-card-bottom"><strong>{stock ? formatMoney(stock.unit_price_kobo, stock.currency) : "Price needed"}</strong><span>{stock?.quantity_available ?? 0} in stock</span></div>
                  {manageable.includes(product.business_id) ? <details className="supplier-product-edit"><summary>Edit listing</summary><form action={updateSupplierProductAction} className="marketplace-product-form"><input type="hidden" name="product_id" value={product.id} /><input type="hidden" name="business_id" value={product.business_id} /><InventoryImageField id={`media-${product.id}`} currentPath={product.image_path ?? ""} currentPaths={product.media_paths ?? []} /><label>Product name<input name="name" defaultValue={product.name} required maxLength={180} /></label><label>Brand<input name="brand" defaultValue={product.brand ?? ""} maxLength={120} /></label><div className="form-grid"><label>Quantity<input name="quantity" type="number" min="0" max="1000000" defaultValue={stock?.quantity_available ?? 0} required /></label><label>Unit price (USD)<input name="price" type="number" min="0" step="0.01" defaultValue={Number(stock?.unit_price_kobo ?? 0) / 100} required /></label></div><div className="form-grid"><label>Condition<select name="condition" defaultValue={product.condition}><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></label><label>Visibility<select name="visibility" defaultValue={product.visibility}><option value="public">Public</option><option value="private">Private</option></select></label></div><label>Specifications<textarea name="specifications" defaultValue={product.specifications ?? ""} maxLength={1000} /></label><label>Listing<select name="is_active" defaultValue={product.is_active ? "yes" : "no"}><option value="yes">Active</option><option value="no">Hidden</option></select></label><button className="button button-primary button-small" type="submit">Save listing</button></form><form action={deleteSupplierProductAction} className="marketplace-delete-form"><input type="hidden" name="product_id" value={product.id} /><ConfirmDeleteButton message="Delete this listing? Listings with order history will be archived instead.">Delete product</ConfirmDeleteButton></form></details> : null}
                </div>
              </article>;
            })}</div> : <div className="panel marketplace-empty"><PackageSearch size={26} /><h2>No products yet</h2><p>Add a real item to your inventory and it can be discovered by buyers on StockSOS.</p><a className="button button-primary" href="#new-product"><PackagePlus size={15} /> Create your first listing</a></div>}
          </div>
          <aside className="panel marketplace-create-panel" id="new-product"><div className="marketplace-create-heading"><span className="feature-icon"><PackagePlus size={19} /></span><span className="eyebrow">New listing</span><h2>Add a product</h2><p>Use bright, clear photos and a short demo video to help buyers understand what you sell.</p></div>
            {manageable.length ? <form action={createSupplierProductAction} className="marketplace-product-form"><label>Business<select name="business_id" required>{manageable.map((id) => <option value={id} key={id}>{businesses.find((item) => item.id === id)?.name}</option>)}</select></label><InventoryImageField id="new-product-media" /><label>Product category<select name="category_id" required defaultValue=""><option value="" disabled>Choose category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label>Product name<input name="name" required minLength={2} maxLength={180} placeholder="e.g. Stainless steel water bottle" /></label><div className="form-grid"><label>Quantity available<input name="quantity" type="number" min="0" max="1000000" defaultValue="0" required /></label><label>Unit price (USD)<input name="price" type="number" min="0" step="0.01" required placeholder="0.00" /></label></div><div className="form-grid"><label>Condition<select name="condition" defaultValue="new"><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></label><label>Visibility<select name="visibility" defaultValue="public"><option value="public">Public</option><option value="private">Private</option></select></label></div><label>Brand <span className="muted">(optional)</span><input name="brand" maxLength={120} placeholder="Brand name" /></label><label>Product details <span className="muted">(optional)</span><textarea name="specifications" maxLength={1000} placeholder="Describe size, features, packaging or variants" /></label><button className="button button-primary form-submit" type="submit"><PackagePlus size={15} /> Publish product</button><p className="form-hint"><Globe2 size={12} /> Public products appear on your supplier storefront and product discovery.</p></form> : <p className="muted small">You need owner, admin or inventory manager access to add products.</p>}
          </aside>
        </div>
      )}
    </div>
  </section>;
}
