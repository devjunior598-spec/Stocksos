import { PricingExperience } from "../../pricing-experience";

export const dynamic = "force-dynamic";

export default async function PlanCheckoutPage({ params, searchParams }: {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ country?: string | string[] }>;
}) {
  const { planId } = await params;
  return <PricingExperience searchParams={searchParams} checkoutPlanId={planId} />;
}
