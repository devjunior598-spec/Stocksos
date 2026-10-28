import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isValidPaystackSignature } from "@/lib/paystack-signature";

const secret = "test-secret";
const body = JSON.stringify({ event: "charge.success", data: { reference: "stk-test" } });
const validSignature = createHmac("sha512", secret).update(body).digest("hex");

describe("Paystack webhook signatures", () => {
  it("accepts the HMAC for the exact raw request body", () => {
    expect(isValidPaystackSignature(body, validSignature, secret)).toBe(true);
  });

  it("rejects modified bodies, wrong keys and malformed signatures", () => {
    expect(isValidPaystackSignature(body + " ", validSignature, secret)).toBe(false);
    expect(isValidPaystackSignature(body, validSignature, "wrong-secret")).toBe(false);
    expect(isValidPaystackSignature(body, "invalid", secret)).toBe(false);
  });
});
