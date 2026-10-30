import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const FIELD_LABELS: Array<[string, string]> = [
  ["home_country", "country"],
  ["home_region", "state / region"],
  ["home_city", "city"],
  ["home_postal_code", "postcode"],
  ["home_area", "area"],
  ["home_address", "delivery address"],
];

export async function ProfileCompletionBanner() {
  const user = await getAuthenticatedUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("profiles")
    .select("home_country,home_region,home_city,home_postal_code,home_area,home_address")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  const missing = FIELD_LABELS.filter(([field]) => !String(data[field as keyof typeof data] ?? "").trim()).map(([, label]) => label);
  if (!missing.length) return null;
  const summary = missing.length > 2
    ? `${missing.slice(0, 2).join(" and ")} + ${missing.length - 2} more`
    : missing.join(" and ");
  return <aside className="profile-completion-banner" role="status">
    <span className="profile-completion-icon"><MapPin size={16} /></span>
    <div className="profile-completion-copy"><strong>Complete your sourcing profile</strong><span>Add {summary} so StockSOS can match nearby suppliers and prefill your requests.</span></div>
    <Link className="profile-completion-link" href="/onboarding">Update settings <ArrowRight size={14} /></Link>
  </aside>;
}
