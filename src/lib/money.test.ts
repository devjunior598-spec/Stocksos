import { describe, expect, it } from "vitest";
import { nairaToKobo, quoteTotalKobo } from "@/lib/money";

describe("nairaToKobo", () => {
  it("converts naira input to integer kobo without floating point rounding", () => {
    expect(nairaToKobo("1500.05")).toBe(150005);
    expect(nairaToKobo("8.5")).toBe(850);
  });

  it("supports zero only when explicitly allowed", () => {
    expect(nairaToKobo("0")).toBeNull();
    expect(nairaToKobo("0", true)).toBe(0);
  });

  it.each(["-1", "1.001", "1e4", " 1", "1.", "1000000000000"])("rejects malformed or unsafe input %s", (input) => {
    expect(nairaToKobo(input, true)).toBeNull();
  });
});

describe("quoteTotalKobo", () => {
  it("includes delivery and rounds the configured platform fee up to a kobo", () => {
    expect(quoteTotalKobo({ unitPriceKobo: 12345, quantity: 3, deliveryFeeKobo: 500, pickup: false, platformFeeBps: 175 }))
      .toEqual({ subtotal: 37035, delivery: 500, platformFee: 649, total: 38184 });
  });

  it("removes delivery fees for pickup and keeps zero-fee orders exact", () => {
    expect(quoteTotalKobo({ unitPriceKobo: 10000, quantity: 2, deliveryFeeKobo: 750, pickup: true, platformFeeBps: 0 }))
      .toEqual({ subtotal: 20000, delivery: 0, platformFee: 0, total: 20000 });
  });
});
