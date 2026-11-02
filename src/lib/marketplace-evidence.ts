import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMarketplaceImagePathForBusiness, isMarketplaceMediaPathForBusiness } from "@/lib/image-path";

export type ProductMedia = {
  id: string;
  business_id: string;
  image_path: string | null;
  media_paths: string[] | null;
};
export type BusinessLogo = { id: string; logo_path: string | null };
export type ArchivedMedia = {
  productId?: string;
  businessId?: string;
  originalPath: string;
  evidencePath: string;
};

const mimeByExtension: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};

export function evidenceContentType(path: string) {
  return mimeByExtension[path.split(".").at(-1)?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

function pathsFor(product: ProductMedia) {
  return [...new Set([product.image_path, ...(product.media_paths ?? [])]
    .filter((path): path is string => Boolean(path)))];
}

/** Copy evidence into a private bucket before removing a public listing. */
export async function preserveProductMedia(products: ProductMedia[]) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Private evidence storage is not configured.");

  const copied: ArchivedMedia[] = [];
  for (const product of products) {
    for (const originalPath of pathsFor(product)) {
      if (!isMarketplaceMediaPathForBusiness(originalPath, product.business_id)) {
        throw new Error(`Unrecognized media path for ${product.id}.`);
      }
      const evidencePath = `${product.id}/${originalPath}`;
      const { data: file, error: downloadError } = await admin.storage
        .from("marketplace-images").download(originalPath);
      if (downloadError || !file) throw new Error(`Could not preserve product media for ${product.id}.`);
      const { error: uploadError } = await admin.storage.from("marketplace-evidence")
        .upload(evidencePath, file, { contentType: evidenceContentType(originalPath), upsert: true });
      if (uploadError) throw new Error(`Could not archive product media for ${product.id}.`);
      copied.push({ productId: product.id, originalPath, evidencePath });
    }
  }

  if (copied.length) {
    const { error } = await admin.from("removal_media").upsert(copied.map((item) => ({
      product_id: item.productId,
      original_path: item.originalPath,
      evidence_path: item.evidencePath,
    })), { onConflict: "evidence_path" });
    if (error) throw new Error("Could not index preserved product media.");
  }

  return copied;
}

export async function preserveBusinessLogos(businesses: BusinessLogo[]) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Private evidence storage is not configured.");
  const copied: ArchivedMedia[] = [];
  for (const business of businesses) {
    const originalPath = business.logo_path;
    if (!originalPath) continue;
    if (!isMarketplaceImagePathForBusiness(originalPath, business.id)) {
      throw new Error(`Unrecognized logo path for ${business.id}.`);
    }
    const evidencePath = `business/${business.id}/${originalPath}`;
    const { data: file, error: downloadError } = await admin.storage
      .from("marketplace-images").download(originalPath);
    if (downloadError || !file) throw new Error(`Could not preserve business logo for ${business.id}.`);
    const { error: uploadError } = await admin.storage.from("marketplace-evidence")
      .upload(evidencePath, file, { contentType: evidenceContentType(originalPath), upsert: true });
    if (uploadError) throw new Error(`Could not archive business logo for ${business.id}.`);
    copied.push({ businessId: business.id, originalPath, evidencePath });
  }
  if (copied.length) {
    const { error } = await admin.from("removal_media").upsert(copied.map((item) => ({
      business_id: item.businessId,
      original_path: item.originalPath,
      evidence_path: item.evidencePath,
    })), { onConflict: "evidence_path" });
    if (error) throw new Error("Could not index preserved business logos.");
  }
  return copied;
}

/** Public copies must be deleted after the database has hidden the listing. */
export async function removePublicArchivedMedia(copied: ArchivedMedia[]) {
  if (!copied.length) return;
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("Private evidence storage is not configured.");
  const paths: string[] = [];
  for (const path of [...new Set(copied.map((item) => item.originalPath))]) {
    const [cover, gallery, logo] = await Promise.all([
      admin.from("products").select("id", { count: "exact", head: true })
        .eq("image_path", path).is("removed_at", null),
      admin.from("products").select("id", { count: "exact", head: true })
        .contains("media_paths", [path]).is("removed_at", null),
      admin.from("businesses").select("id", { count: "exact", head: true })
        .eq("logo_path", path).eq("visibility", "public"),
    ]);
    if (cover.error || gallery.error || logo.error) throw new Error("Could not verify media references.");
    if (!(cover.count || gallery.count || logo.count)) paths.push(path);
  }
  if (!paths.length) return;
  const { error } = await admin.storage.from("marketplace-images").remove(paths);
  if (error) throw new Error("The listing is hidden, but its former public media needs cleanup.");
}
