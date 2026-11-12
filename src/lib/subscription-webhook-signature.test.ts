import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySubscriptionWebhookSignature } from "@/lib/subscription-webhook-signature";

const rawBody = Buffer.from('{"event":"charge.success","data":{"reference":"ssub-12345678"}}');
const webhookSecret = "whsec_test-signing-secret";
const secretKey = "sk_test_legacy-key";
const now = 1_800_000_000;

function currentHeader(body = rawBody, timestamp = now) {
  const signature = createHmac("sha512", webhookSecret)
    .update(`${timestamp}.`).update(body).digest("hex");
  return `t=${timestamp},v1=whk_test:${signature}`;
}

describe("supplier subscription webhook signatures", () => {
  it("accepts a current signed raw body within the replay window", () => {
    expect(verifySubscriptionWebhookSignature({ rawBody, paystackSignature: currentHeader(), webhookSecrets: [webhookSecret], nowSeconds: now }))
      .toEqual({ valid: true, scheme: "current", keyId: "whk_test" });
  });

  it("rejects an old event, changed body, and a downgrade attempt", () => {
    const legacy = createHmac("sha512", secretKey).update(rawBody).digest("hex");
    expect(verifySubscriptionWebhookSignature({ rawBody, paystackSignature: currentHeader(rawBody, now - 301), webhookSecrets: [webhookSecret], nowSeconds: now }).valid).toBe(false);
    expect(verifySubscriptionWebhookSignature({ rawBody: Buffer.concat([rawBody, Buffer.from(" ")]), paystackSignature: currentHeader(), webhookSecrets: [webhookSecret], nowSeconds: now }).valid).toBe(false);
    expect(verifySubscriptionWebhookSignature({ rawBody, paystackSignature: "t=0,v1=whk_test:bad", legacySignature: legacy, secretKey, webhookSecrets: [webhookSecret], nowSeconds: now }).valid).toBe(false);
  });

  it("accepts legacy signature only when the current header is absent", () => {
    const legacy = createHmac("sha512", secretKey).update(rawBody).digest("hex");
    expect(verifySubscriptionWebhookSignature({ rawBody, legacySignature: legacy, secretKey }))
      .toEqual({ valid: true, scheme: "legacy" });
  });
});
