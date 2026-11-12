import { afterEach, describe, expect, it, vi } from "vitest";
import {
  allowedSubscriptionChannels,
  initializeSubscriptionPaystackCheckout,
  verifySubscriptionPaystackCheckout,
} from "@/lib/subscription-paystack";

const identity = {
  secretKey: "sk_test_example",
  mode: "test" as const,
  reference: "stk-sub-12345678",
  amountMinor: 120000,
  currency: "NGN" as const,
  countryCode: "NG",
  method: "bank_transfer" as const,
};

function response(data: Record<string, unknown>, ok = true) {
  return { ok, json: async () => ({ status: true, data }) };
}

afterEach(() => vi.unstubAllGlobals());

describe("supplier subscription Paystack checkout", () => {
  it("restricts bank transfer to Nigeria in NGN and card elsewhere", () => {
    expect(allowedSubscriptionChannels("NG", "NGN", "bank_transfer")).toEqual(["bank_transfer"]);
    expect(allowedSubscriptionChannels("US", "NGN", "bank_transfer")).toBeNull();
    expect(allowedSubscriptionChannels("NG", "USD", "bank_transfer")).toBeNull();
    expect(allowedSubscriptionChannels("US", "NGN", "card")).toEqual(["card"]);
  });

  it("initializes only the quoted checkout method and amount", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      authorization_url: "https://checkout.paystack.com/test-checkout",
      reference: identity.reference,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await initializeSubscriptionPaystackCheckout({
      ...identity,
      email: "supplier@example.com",
      callbackUrl: "https://stocksosglobal.com/supplier/billing/callback",
      checkoutId: "5ea1dbca-c568-4f3a-a3f7-a4b4e1852e31",
    });
    expect(result).toEqual({
      authorizationUrl: "https://checkout.paystack.com/test-checkout",
      reference: identity.reference,
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.paystack.co/transaction/initialize");
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({
      email: "supplier@example.com",
      amount: "120000",
      currency: "NGN",
      reference: identity.reference,
      channels: ["bank_transfer"],
    });
    expect(body).not.toHaveProperty("plan");
  });

  it("rejects a mode/key mismatch, forbidden transfer, and non-Paystack checkout URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({
      authorization_url: "https://malicious.example/pay",
      reference: identity.reference,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const common = {
      ...identity,
      email: "supplier@example.com",
      callbackUrl: "https://stocksosglobal.com/supplier/billing/callback",
      checkoutId: "5ea1dbca-c568-4f3a-a3f7-a4b4e1852e31",
    };
    expect(await initializeSubscriptionPaystackCheckout({ ...common, countryCode: "US" })).toBeNull();
    expect(await initializeSubscriptionPaystackCheckout({ ...common, mode: "live" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await initializeSubscriptionPaystackCheckout(common)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("verifies amount, reference, currency, mode, and channel before success", async () => {
    const verifiedData = {
      id: 4099260516,
      status: "success",
      reference: identity.reference,
      amount: identity.amountMinor,
      currency: identity.currency,
      domain: "test",
      channel: "bank_transfer",
      paid_at: "2026-11-10T09:15:02.000Z",
    };
    const fetchMock = vi.fn().mockResolvedValue(response(verifiedData));
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifySubscriptionPaystackCheckout(identity)).toEqual({
      state: "succeeded",
      transactionId: "4099260516",
      paidAt: verifiedData.paid_at,
      channel: "bank_transfer",
    });

    for (const mismatch of [
      { amount: 100 },
      { reference: "another-reference" },
      { currency: "USD" },
      { domain: "live" },
      { channel: "card" },
      { paid_at: null },
    ]) {
      fetchMock.mockResolvedValueOnce(response({ ...verifiedData, ...mismatch }));
      expect(await verifySubscriptionPaystackCheckout(identity)).toEqual({ state: "invalid" });
    }
  });

  it("keeps incomplete payments pending and detects failed and unavailable verifications", async () => {
    const base = {
      reference: identity.reference,
      amount: identity.amountMinor,
      currency: identity.currency,
      domain: "test",
      channel: "bank_transfer",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ ...base, status: "ongoing" }))
      .mockResolvedValueOnce(response({ ...base, status: "failed" }))
      .mockResolvedValueOnce(response({}, false))
      .mockRejectedValueOnce(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifySubscriptionPaystackCheckout(identity)).toEqual({ state: "pending" });
    expect(await verifySubscriptionPaystackCheckout(identity)).toEqual({ state: "failed" });
    expect(await verifySubscriptionPaystackCheckout(identity)).toEqual({ state: "unavailable" });
    expect(await verifySubscriptionPaystackCheckout(identity)).toEqual({ state: "unavailable" });
  });
});
