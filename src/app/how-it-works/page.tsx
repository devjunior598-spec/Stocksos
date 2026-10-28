import { InfoPage } from "@/components/info-page";

export default function HowItWorksPage() {
  return <InfoPage
    eyebrow="How StockSOS works"
    title="A clear path from stockout to supply."
    intro="StockSOS helps businesses describe what they need, reach relevant approved suppliers, compare quotations, and choose how to proceed."
    cards={[
      { title: "Start with the item", description: "Name the product and category, say how many you need, and include useful specifications." },
      { title: "Set your place and timing", description: "Choose a city, pickup or delivery preference, and the urgency that fits your business." },
      { title: "Compare supplier offers", description: "Review offered quantity, price, delivery availability and preparation estimates." },
      { title: "Choose the next step", description: "Accept an offer to create an order. Payment and delivery availability depend on configured services." },
    ]}
    sections={[
      { heading: "An urgency choice is a preference", paragraphs: ["A buyer’s timing selection helps suppliers understand the request. It does not guarantee that stock or delivery will be available within that time. Suppliers confirm availability and their own preparation estimates in each quotation."] },
      { heading: "Supplier approval comes first", paragraphs: ["Businesses apply to join and remain pending until an administrator verifies them. Public stock discovery and SOS matching are limited to approved suppliers."] },
    ]}
    action={{ label: "Create an SOS request", href: "/sos" }}
  />;
}
