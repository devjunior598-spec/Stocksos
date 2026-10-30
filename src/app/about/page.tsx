import { InfoPage } from "@/components/info-page";

export default function AboutPage() {
  return <InfoPage
    eyebrow="About StockSOS"
    title="A stock network built around business continuity."
    intro="StockSOS is a global marketplace that helps businesses find nearby supply and helps approved suppliers reach buyers with urgent needs."
    sections={[
      { heading: "Local supply, worldwide reach", paragraphs: ["StockSOS supports businesses across countries while matching each request with relevant local inventory, transparent quotations and practical fulfilment choices."] },
      { heading: "Built for trust", paragraphs: ["Supplier applications begin in a pending state. Buyers can compare offers before they decide whether to place an order, and transaction state is designed to be verified server-side."] },
      { heading: "Our promise", paragraphs: ["Find the stock you need. Sell the stock you have. Rescue your business in minutes. StockSOS helps make the next step clearer; suppliers still confirm availability and delivery estimates."] },
    ]}
    action={{ label: "See how it works", href: "/how-it-works" }}
  />;
}
