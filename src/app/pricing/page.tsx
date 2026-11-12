import { PricingExperience } from "./pricing-experience";

export const dynamic = "force-dynamic";

export default function PricingPage({ searchParams }: { searchParams: Promise<{ upgrade?: string | string[]; country?: string | string[] }> }) {
  return <PricingExperience searchParams={searchParams} />;
}
