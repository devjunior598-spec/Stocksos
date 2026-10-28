import { InfoPage } from "@/components/info-page";

export default function HelpPage() {
  return <InfoPage
    eyebrow="Help centre"
    title="Straight answers for StockSOS users."
    intro="Here are the basics for sourcing, supplying and protecting your business information."
    sections={[
      { heading: "How do I request stock?", paragraphs: ["Sign in, choose Send an SOS, select the closest category, describe the item and quantity, then enter your city and timing preference. Requests are sent to approved suppliers matched by category, city and active public inventory."] },
      { heading: "Does an SOS guarantee a delivery time?", paragraphs: ["No. The urgency option represents your preference. A supplier must confirm availability, preparation time and delivery arrangements in a quotation."] },
      { heading: "How do supplier applications work?", paragraphs: ["Create an account and submit the business application. The application remains pending until StockSOS completes its verification review. Pending businesses cannot publish public listings or quote on requests."] },
      { heading: "When is an order paid?", paragraphs: ["Accepting an available quotation creates an order in an awaiting-payment state. Payment is not considered successful until the backend verifies the provider response. If checkout is not configured, the platform will not claim that a payment succeeded."] },
      { heading: "How do I report a problem?", paragraphs: ["Use the Contact page to find the right support route. Share only the details needed to identify the request or order; never send your password or full card information."] },
    ]}
  />;
}
