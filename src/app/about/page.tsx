import { InfoPage } from "@/components/info-page";

export default function AboutPage() {
  return <InfoPage
    eyebrow="About StockSOS"
    title="A stock network built around business continuity."
    intro="StockSOS is being developed by JuniorDev Tech Solutions to help businesses find nearby supply and help suppliers reach buyers with urgent needs."
    sections={[
      { heading: "Starting close to the problem", paragraphs: ["The first market focus is Ibadan, Nigeria. The platform is designed around local business inventory, clear quotations and practical fulfilment choices."] },
      { heading: "Built for trust", paragraphs: ["Supplier applications begin in a pending state. Buyers can compare offers before they decide whether to place an order, and transaction state is designed to be verified server-side."] },
      { heading: "Our promise", paragraphs: ["Find the stock you need. Sell the stock you have. Rescue your business in minutes. StockSOS helps make the next step clearer; suppliers still confirm availability and delivery estimates."] },
    ]}
    action={{ label: "See how it works", href: "/how-it-works" }}
  />;
}
