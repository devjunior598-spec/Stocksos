import { InfoPage } from "@/components/info-page";

export default function PrivacyPage() {
  return <InfoPage
    eyebrow="Legal"
    title="Privacy policy"
    intro="StockSOS uses account and business information to operate sourcing, quotations and order workflows. This launch summary needs a formal review against the Nigeria Data Protection Act and applicable rules before production."
    sections={[
      { heading: "Information we use", paragraphs: ["Depending on how you use StockSOS, the platform may process account details, contact information, business profiles, inventory, SOS requests, quotations, order records, support requests and verification documents."] },
      { heading: "How information is used", paragraphs: ["Data is used to authenticate accounts, match requests with suppliers, support orders, protect the marketplace, send activity notices and meet legal or operational requirements. Buyer contact details are not included in the supplier match payload."] },
      { heading: "Access and retention", paragraphs: ["Row Level Security limits records to their owner, relevant business members, authorized support staff or administrators. Retention and deletion rules must be configured to meet legal and operational requirements before launch."] },
      { heading: "Your choices", paragraphs: ["Contact StockSOS through the account support route to request access, correction or deletion review. Deletion may be limited by payment, fraud, tax or dispute-record requirements."] },
      { heading: "Service providers", paragraphs: ["Supabase, the payment provider and any configured email or messaging provider may process data needed for their services. External notifications require user consent and suitable provider configuration."] },
    ]}
  />;
}
