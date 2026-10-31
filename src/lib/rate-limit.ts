import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RateLimitOptions = {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
};

/**
 * Uses a Supabase-backed counter so limits work across Vercel instances and
 * regions. It is fail-open only when the server-only service key is missing,
 * which keeps local development usable; production must configure the key and
 * apply the rate-limit migration.
 */
export async function consumeRateLimit(options: RateLimitOptions) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { allowed: true, configured: false };
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_scope: options.scope,
    p_identifier: options.identifier,
    p_limit: options.limit,
    p_window_seconds: options.windowSeconds,
  });
  if (error) {
    console.error("Rate-limit check failed", { scope: options.scope, code: error.code });
    return { allowed: true, configured: true, error: true };
  }
  return { allowed: data === true, configured: true };
}

export function getRequestIdentifier(headers: Pick<Headers, "get">) {
  return headers.get("x-vercel-forwarded-for")
    ?? headers.get("x-real-ip")
    ?? headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim()
    ?? "unknown-client";
}
