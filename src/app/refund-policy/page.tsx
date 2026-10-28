import { InfoPage } from "@/components/info-page";

export default function RefundPolicyPage() {
  return <InfoPage
    eyebrow="Legal"
    title="Refund and cancellation policy"
    intro="This initial policy outlines the intended support path. It is not a promise that every transaction is refundable; final terms must be approved for StockSOS’s payment and marketplace arrangements."
    sections={[
      { heading: "Before payment", paragraphs: ["A buyer may cancel an open SOS request before accepting a quotation. An accepted quotation creates an order that may have supplier preparation or delivery arrangements attached."] },
      { heading: "After payment", paragraphs: ["If a paid order cannot be fulfilled, the buyer should open a support case with the order details. Refund eligibility, timing and the payment provider’s process will depend on the transaction facts and applicable law."] },
      { heading: "No automatic refund claim", paragraphs: ["A browser redirect or payment screenshot is not proof of payment or a refund. StockSOS must verify payment events with the provider before changing transaction records."] },
      { heading: "Disputes", paragraphs: ["Report missing items, damage, failed delivery or a pricing difference promptly through account support. Keep receipts and relevant order messages available."] },
    ]}
  />;
}
