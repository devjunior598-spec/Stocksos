import { InfoPage } from "@/components/info-page";

export default function TermsPage() {
  return <InfoPage
    eyebrow="Legal"
    title="Terms of service"
    intro="These launch terms explain the basic roles and responsibilities in the StockSOS marketplace. They require review by qualified Nigerian counsel before public commercial launch."
    sections={[
      { heading: "Marketplace role", paragraphs: ["StockSOS helps buyers discover participating suppliers and compare quotations. The supplier is responsible for confirming the accuracy, availability, condition and lawful sale of listed goods. A buyer chooses whether to accept an offer."] },
      { heading: "Accounts and business information", paragraphs: ["Users must provide accurate account information and protect their login credentials. Business listings and verification documents must relate to the applying business. StockSOS may restrict marketplace access while a verification or safety issue is reviewed."] },
      { heading: "Orders and payment", paragraphs: ["An accepted quotation creates an order. Payment is complete only after verified provider confirmation. Nothing in the platform creates an escrow, stored-value wallet or guaranteed supplier payout unless a separate lawful arrangement is expressly made."] },
      { heading: "Delivery and disputes", paragraphs: ["Suppliers and buyers must confirm delivery arrangements and report missing, damaged or delayed items promptly. A delivery estimate is not a guaranteed delivery promise."] },
      { heading: "Use of the service", paragraphs: ["Users may not submit fraudulent requests, misrepresent inventory, interfere with another account, or use the service to violate applicable law."] },
    ]}
  />;
}
