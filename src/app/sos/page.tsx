import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CircleAlert, Zap } from "lucide-react";
import { createSOSAction } from "@/app/actions";
import { getAuthenticatedUser, getMarketplaceRole } from "@/lib/auth";
import { getCategories } from "@/lib/data";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { SOSAIRequest } from "@/components/sos-ai-request";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function SOSPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await getAuthenticatedUser();
  if (user && await getMarketplaceRole(user.id) === "supplier") redirect("/supplier");
  const categories = await getCategories();
  const supabase = user ? await (await import("@/lib/supabase/server")).createSupabaseServerClient() : null;
  const profileResult = supabase && user
    ? await supabase.from("profiles").select("home_city,home_country,home_region,home_postal_code,home_area,home_address,default_delivery_method").eq("id", user.id).maybeSingle()
    : { data: null, error: null };
  const profile = profileResult.error && supabase && user
    ? (await supabase.from("profiles").select("home_city").eq("id", user.id).maybeSingle()).data
    : profileResult.data;
  const location = {
    country: (profile as { home_country?: string } | null)?.home_country ?? "",
    region: (profile as { home_region?: string } | null)?.home_region ?? "",
    city: profile?.home_city ?? "",
    postalCode: (profile as { home_postal_code?: string } | null)?.home_postal_code ?? "",
    area: (profile as { home_area?: string } | null)?.home_area ?? "",
    address: (profile as { home_address?: string } | null)?.home_address ?? "",
    defaultDeliveryMethod: ((profile as { default_delivery_method?: "pickup" | "delivery" | "flexible" | "both" } | null)?.default_delivery_method ?? "both"),
  };
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return (
    <>
      <section className="page-hero"><div className="page-container"><span className="eyebrow"><Zap size={14} /> SOS Now</span><h1>Tell StockSOS. We’ll find it.</h1><p className="lead">A shorter, conversational way to source stock from approved suppliers.</p><p className="metric-note"><CircleAlert size={14} /> You review and confirm before anything is sent.</p></div></section>
      <section className="page-container">
        {!configured ? <div className="form-panel"><SupabaseSetupNotice /></div> : !user ? <div className="form-panel empty-state"><div className="empty-state-icon"><Zap size={22} /></div><h3>Sign in to send a request</h3><p>Your request stays connected to your account so you can compare offers and track any resulting order.</p><Link className="button button-primary" href="/login?next=/sos">Log in to continue <ArrowRight size={15} /></Link></div> : (
          <SOSAIRequest categories={categories} location={location} action={createSOSAction} error={params.error} />
        )}
      </section>
    </>
  );
}
