import { describe, expect, it } from "vitest";
import { estimateLocalMinor } from "@/lib/local-currency-estimate";

const rates = { USD: 1, GBP: 0.78, NGN: 1500 };

describe("local plan price estimates", () => {
  it("shows a GBP reference estimate while keeping the USD charge separate", () => {
    expect(estimateLocalMinor(900, "USD", "GBP", rates)).toBe(702);
    expect(estimateLocalMinor(900, "USD", "USD", rates)).toBe(900);
  });

  it("converts an NGN checkout amount for display without changing the charge", () => {
    expect(estimateLocalMinor(150_000, "NGN", "USD", rates)).toBe(100);
  });

  it("does not invent a rate when the local currency is unavailable", () => {
    expect(estimateLocalMinor(900, "USD", "XYZ", rates)).toBeNull();
    expect(estimateLocalMinor(-100, "USD", "GBP", rates)).toBeNull();
    expect(estimateLocalMinor(900, "NGN", "GBP", { USD: 1, GBP: 0.78 })).toBeNull();
  });
});
