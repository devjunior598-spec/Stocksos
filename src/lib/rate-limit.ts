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
 * regions. Local development remains usable without a service key. Hosted
 * deployments deny limited operations when the check cannot run, so a missing
 * key or database function cannot silently disable abuse protection.
 */
export async function consumeRateLimit(options: RateLimitOptions) {
  const hosted = process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview";
  const admin = createSupabaseAdminClient();
  if (!admin) {
    if (hosted) console.error("Rate-limit service unavailable", { scope: options.scope });
    return { allowed: !hosted, configured: hosted, error: hosted };
  }
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_scope: options.scope,
    p_identifier: options.identifier,
    p_limit: options.limit,
    p_window_seconds: options.windowSeconds,
  });
  if (error) {
    console.error("Rate-limit check failed", { scope: options.scope, code: error.code });
    return { allowed: !hosted, configured: true, error: true };
  }
  return { allowed: data === true, configured: true };
}

export function getRequestIdentifier(headers: Pick<Headers, "get">) {
  return headers.get("x-vercel-forwarded-for")
    ?? headers.get("x-real-ip")
    ?? headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim()
    ?? "unknown-client";
}
