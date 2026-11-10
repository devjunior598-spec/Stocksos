import { describe, expect, it } from "vitest";
import { summarizeVerifiedPayments } from "./growth-metrics";

const payment = (overrides: Partial<Parameters<typeof summarizeVerifiedPayments>[0][number]> = {}) => ({
  id: "payment-1",
  status: "succeeded",
  amount_kobo: 12500,
  currency: "USD",
  verified_at: "2026-11-10T00:00:00Z",
  ...overrides,
});

describe("verified payment volume", () => {
  it("keeps currencies separate and sums only verified records", () => {
    expect(summarizeVerifiedPayments([
      payment(),
      payment({ id: "payment-2", amount_kobo: 7500 }),
      payment({ id: "payment-3", currency: "NGN", amount_kobo: 4000 }),
    ], 3)).toEqual([
      { currency: "NGN", amountMinor: 4000 },
      { currency: "USD", amountMinor: 20000 },
    ]);
  });

  it("withholds a total for truncated, duplicated, or unverified data", () => {
    expect(summarizeVerifiedPayments([payment()], 2)).toBeNull();
    expect(summarizeVerifiedPayments([payment(), payment()], 2)).toBeNull();
    expect(summarizeVerifiedPayments([payment({ verified_at: null })], 1)).toBeNull();
    expect(summarizeVerifiedPayments([payment({ status: "pending" })], 1)).toBeNull();
  });
});
