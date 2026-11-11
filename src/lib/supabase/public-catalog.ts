import "server-only";

import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Preview catalogue reads use an anonymous client with no session or service key. */
export function hasPreviewCatalog() {
  return process.env.VERCEL_ENV === "preview" && Boolean(
    process.env.PREVIEW_CATALOG_SUPABASE_URL && process.env.PREVIEW_CATALOG_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function publicCatalogUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL
    || (hasPreviewCatalog() ? process.env.PREVIEW_CATALOG_SUPABASE_URL : undefined);
}

export async function createPublicCatalogClient() {
  const accountClient = await createSupabaseServerClient();
  if (accountClient) return accountClient;
  if (!hasPreviewCatalog()) return null;
  return createClient(
    process.env.PREVIEW_CATALOG_SUPABASE_URL!,
    process.env.PREVIEW_CATALOG_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
