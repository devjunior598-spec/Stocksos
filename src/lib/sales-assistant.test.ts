import { describe, expect, it } from "vitest";
import { hasPaidAssistantAccess, safeAssistantReply } from "./sales-assistant";

describe("supplier sales assistant safeguards", () => {
  it("requires an active, unexpired paid entitlement", () => {
    const now = Date.parse("2026-11-03T12:00:00Z");
    expect(hasPaidAssistantAccess(null, now)).toBe(false);
    expect(hasPaidAssistantAccess({ status: "active", paid_through: "2026-11-03T11:59:59Z" }, now)).toBe(false);
    expect(hasPaidAssistantAccess({ status: "cancelled", paid_through: "2026-11-04T00:00:00Z" }, now)).toBe(false);
    expect(hasPaidAssistantAccess({ status: "active", paid_through: "2026-11-04T00:00:00Z" }, now)).toBe(true);
  });

  it("does not relay generated payment destinations", () => {
    expect(safeAssistantReply("Pay to bank account 12345 now")).toContain("payment and custom terms need confirmation");
    expect(safeAssistantReply("Checkout here: https://pay.example.com/checkout")).toContain("payment and custom terms need confirmation");
    expect(safeAssistantReply("Your payment is confirmed and a receipt is issued.")).toContain("payment and custom terms need confirmation");
    expect(safeAssistantReply("The listed price is $12 per unit.")).toBe("The listed price is $12 per unit.");
  });
});
