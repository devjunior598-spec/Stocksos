import "server-only";

import { readSignupProfile } from "@/lib/signup-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseClient = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

/** Copy verified sign-up details into the user's private profile once a session exists. */
export async function saveSignupProfileFromMetadata(supabase: SupabaseClient) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return false;
  const profile = readSignupProfile(user.user_metadata?.signup_profile);
  if (!profile) return true; // Existing accounts have no sign-up draft.

  const { data: current, error: readError } = await supabase.from("profiles")
    .select("home_country").eq("id", user.id).maybeSingle();
  if (readError || !current) return false;
  if (current.home_country) return true; // Never overwrite later edits in Account Settings.

  const phone = typeof user.user_metadata?.phone === "string" && /^\+[1-9]\d{7,14}$/.test(user.user_metadata.phone)
    ? user.user_metadata.phone : null;
  const { error } = await supabase.from("profiles").update({
    phone,
    home_country: profile.country,
    home_region: profile.region,
    home_city: profile.city,
    home_postal_code: profile.postalCode || null,
    home_area: profile.area || null,
    home_address: profile.address || null,
    default_delivery_method: profile.defaultDeliveryMethod,
    updated_at: new Date().toISOString(),
  }).eq("id", user.id);
  return !error;
}
