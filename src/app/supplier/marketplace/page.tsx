import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgeCheck, CheckCircle2, CircleAlert, ImagePlus, PackagePlus, PackageSearch, Store, Video } from "lucide-react";
import { deleteSupplierProductAction, updateSupplierProductAction } from "@/app/actions";
import { requireSupplier } from "@/lib/auth";
import { formatMoney, getMarketplaceImageUrl } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProductListingQualityIssues } from "@/lib/product-quality";
import { InventoryImageField } from "@/components/inventory-image-field";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ product?: string; error?: string; image?: string; edit?: string }> };

export default async function SupplierMarketplacePage({ searchParams }: Props) {
  const user = await requireSupplier();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const membershipResult = await supabase!.from("business_memberships").select("business_id,role,businesses(id,name,slug,city,verification_status,visibility)").eq("user_id", user.id).order("created_at");
  const memberships = (membershipResult.data ?? []) as unknown as { business_id: string; role: string; businesses: { id: string; name: string; slug: string; city: string; verification_status: string; visibility: string } | { id: string; name: string; slug: string; city: string; verification_status: string; visibility: string }[] | null }[];
  const businesses = memberships.map((row) => Array.isArray(row.businesses) ? row.businesses[0] : row.businesses).filter((business): business is NonNullable<typeof business> => Boolean(business));
  const approvedIds = businesses.filter((business) => business.verification_status === "approved").map((business) => business.id);
  const editId = z.uuid().safeParse(params.edit).success ? params.edit : null;
  const productsQuery = supabase!.from("products")
    .select("id,business_id,name,brand,specifications,image_path,media_paths,category_id,condition,is_active,visibility,inventory(quantity_available,unit_price_kobo,currency)")
    .in("business_id", approvedIds);
  const productsResult = approvedIds.length ? await (editId
    ? productsQuery.eq("id", editId).limit(1)
    : productsQuery.order("created_at", { ascending: false }).limit(100)) : { data: [] };
  const products = (productsResult.data ?? []) as unknown as { id: string; business_id: string; name: string; brand: string | null; specifications: string | null; image_path: string | null; media_paths: string[]; category_id: string; condition: string; is_active: boolean; visibility: string; inventory: { quantity_available: number; unit_price_kobo: number; currency: string } | { quantity_available: number; unit_price_kobo: number; currency: string }[] | null }[];
  const manageable = memberships.filter((row) => ["owner", "admin", "inventory"].includes(row.role)).map((row) => row.business_id).filter((id) => approvedIds.includes(id));
  const removable = memberships.filter((row) => ["owner", "admin"].includes(row.role)).map((row) => row.business_id);
  const publicBusinessIds = new Set(businesses.filter((business) => business.verification_status === "approved" && business.visibility === "public").map((business) => business.id));
  const inStock = (product: (typeof products)[number]) => {
    const stock = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
    return (stock?.quantity_available ?? 0) > 0;
  };
  const availableCount = products.filter((item) => item.is_active && item.visibility === "public" && publicBusinessIds.has(item.business_id) && inStock(item)).length;

  return <section className="supplier-marketplace-page">
    <div className="page-container">
      <Link className="text-link marketplace-back" href="/supplier"><ArrowLeft size={15} /> Supplier workspace</Link>
      <div className="marketplace-page-heading"><div><span className="eyebrow"><Store size={14} /> Supplier marketplace</span><h1>Your products, ready to be discovered.</h1><p className="lead">Create polished listings with clear product photos, video, accurate availability and pricing.</p></div><div className="marketplace-page-count"><strong>{availableCount}</strong><span>available in view</span></div></div>
      {params.product ? <div className="notice success-notice marketplace-publish-success" role="status"><CheckCircle2 size={22} /><div><strong>{params.product === "created" ? "Product added successfully." : params.product === "updated" ? "Product updated successfully." : params.product === "deleted" ? "Product deleted." : params.product === "archived" ? "Listing archived." : "Product saved."}</strong><p>{params.product === "created" ? "Your listing is now in your product list. Public listings can be discovered by buyers." : params.product === "updated" ? "Your latest product details and availability have been saved." : params.product === "archived" ? "This listing is no longer public. Its details and media were preserved privately for authorized reviews." : "Your marketplace product list has been updated."}</p><div className="marketplace-publish-actions"><Link href="/supplier/marketplace/new">Add another product <ArrowRight size={13} /></Link><Link href="/supplier">Back to workspace <ArrowRight size={13} /></Link></div></div></div> : null}
      {params.error ? <div className="notice error-notice" role="alert"><div><strong>{params.error === "name" ? "Use a specific product name." : params.error === "photo" ? "Add a product photo before publishing publicly." : params.error === "evidence" ? "The listing was not removed." : params.error === "media_cleanup" ? "The listing was hidden, but its old public media needs cleanup." : "We couldn’t save that listing."}</strong><p>{params.error === "name" ? "Replace generic names such as “Good”, “Item” or “Test” with the product name buyers recognize." : params.error === "photo" ? "Upload at least one clear photo of the actual product. Private listings can remain without a photo." : params.error === "evidence" ? "Its media could not be copied to private evidence storage. Contact StockSOS support." : params.error === "media_cleanup" ? "An administrator can retry the public media cleanup from Removed records." : "Check the product details and try again."}</p></div></div> : null}
      {params.image === "error" ? <div className="notice error-notice" role="alert"><div><strong>Media could not be connected to this listing.</strong><p>Try adding the photo or video again.</p></div></div> : null}

      {!businesses.length ? <div className="panel marketplace-empty"><PackageSearch size={26} /><h2>Your supplier profile is not set up yet.</h2><p>Submit your business details before publishing products.</p><Link className="button button-primary" href="/become-supplier">Add your business <ArrowRight size={15} /></Link></div> : !approvedIds.length ? <div className="panel marketplace-empty"><BadgeCheck size={26} /><h2>Business approval is required before publishing.</h2><p>Once your supplier account is approved, your business storefront will be ready for product listings.</p></div> : (
        <div className="supplier-marketplace-grid supplier-marketplace-list-only">
          <div className="marketplace-listings">
            <div className="marketplace-subhead"><div><h2>{editId ? "Edit selected product" : "Published and draft products"}</h2><p>Only active public listings with available stock appear in buyer search.</p></div>{editId ? <Link className="text-link" href="/supplier/marketplace">Show all products <ArrowRight size={15} /></Link> : <Link className="text-link" href="/supplier/marketplace/new"><PackagePlus size={15} /> Add product</Link>}</div>
            {products.length ? <div className="supplier-product-grid">{products.map((product) => {
              const stock = Array.isArray(product.inventory) ? product.inventory[0] : product.inventory;
              const business = businesses.find((item) => item.id === product.business_id);
              const imagePath = product.image_path ?? product.media_paths?.find((path) => /\.(jpg|png|webp)$/i.test(path)) ?? "";
              const imageUrl = getMarketplaceImageUrl(imagePath);
              const mediaCount = product.media_paths?.length ?? (imagePath ? 1 : 0);
              const qualityIssues = getProductListingQualityIssues(product);
              return <article className="supplier-product-card" id={`product-${product.id}`} key={product.id}>
                <Link className="supplier-product-photo" href={`/product/${product.id}`} aria-label={`Preview ${product.name}`}>
                  {imageUrl ? <Image src={imageUrl} alt={product.name} fill unoptimized sizes="(max-width: 720px) 100vw, 320px" /> : <span className="supplier-photo-empty"><PackageSearch size={24} />Add a cover photo</span>}
                  {product.media_paths?.some((path) => /\.(mp4|webm)$/i.test(path)) ? <span className="supplier-product-video-badge"><Video size={12} /> Video</span> : null}
                  <span className={`pill ${product.is_active && product.visibility === "public" && publicBusinessIds.has(product.business_id) && inStock(product) ? "pill-green" : "pill-orange"}`}>{!product.is_active || product.visibility !== "public" ? "Hidden" : !publicBusinessIds.has(product.business_id) ? "Storefront hidden" : inStock(product) ? "Available" : "Out of stock"}</span>
                </Link>
                <div className="supplier-product-card-copy"><div className="supplier-product-card-top"><span>{business?.name}</span><span><ImagePlus size={12} /> {mediaCount}</span></div><h3>{product.name}</h3><p>{[product.brand, business?.city].filter(Boolean).join(" · ") || "Stock listing"}</p>{qualityIssues.length ? <p className="supplier-product-quality-note"><CircleAlert size={13} /> {qualityIssues[0]}</p> : null}<div className="supplier-product-card-bottom"><strong>{stock ? formatMoney(stock.unit_price_kobo, stock.currency) : "Price needed"}</strong><span>{stock?.quantity_available ?? 0} in stock</span></div>
                  {manageable.includes(product.business_id) ? <details className="supplier-product-edit" open={params.edit === product.id}><summary>Edit listing</summary><form action={updateSupplierProductAction} className="marketplace-product-form"><input type="hidden" name="product_id" value={product.id} /><input type="hidden" name="business_id" value={product.business_id} /><InventoryImageField id={`media-${product.id}`} currentPath={product.image_path ?? ""} currentPaths={product.media_paths ?? []} photoRequiredForPublic /><label>Product name<input name="name" defaultValue={product.name} required minLength={3} maxLength={180} /></label><label>Brand<input name="brand" defaultValue={product.brand ?? ""} maxLength={120} /></label><div className="form-grid"><label>Quantity<input name="quantity" type="number" min="0" max="1000000" defaultValue={stock?.quantity_available ?? 0} required /></label><label>Unit price (USD)<input name="price" type="number" min="0" step="0.01" defaultValue={Number(stock?.unit_price_kobo ?? 0) / 100} required /></label></div><div className="form-grid"><label>Condition<select name="condition" defaultValue={product.condition}><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></label><label>Visibility<select name="visibility" defaultValue={product.visibility}><option value="public">Public</option><option value="private">Private</option></select></label></div><label>Specifications<textarea name="specifications" defaultValue={product.specifications ?? ""} maxLength={1000} /></label><label>Listing<select name="is_active" defaultValue={product.is_active ? "yes" : "no"}><option value="yes">Active</option><option value="no">Hidden</option></select></label><button className="button button-primary button-small" type="submit">Save listing</button></form>{removable.includes(product.business_id) ? <form action={deleteSupplierProductAction} className="marketplace-delete-form"><input type="hidden" name="product_id" value={product.id} /><ConfirmDeleteButton message="Remove this listing from the marketplace? Its details and media will be kept privately for authorized reviews.">Remove product</ConfirmDeleteButton></form> : null}</details> : null}
                </div>
              </article>;
            })}</div> : <div className="panel marketplace-empty"><PackageSearch size={26} /><h2>No products yet</h2><p>Add a real item to your inventory and it can be discovered by buyers on StockSOS.</p><Link className="button button-primary" href="/supplier/marketplace/new"><PackagePlus size={15} /> Create your first listing</Link></div>}
          </div>
        </div>
      )}
    </div>
  </section>;
}
