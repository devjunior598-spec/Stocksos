import { createHmac, timingSafeEqual } from "node:crypto";

export type SubscriptionWebhookSignatureResult =
  | { valid: true; scheme: "current"; keyId: string }
  | { valid: true; scheme: "legacy" }
  | { valid: false };

type SignatureInput = {
  // Preserve the exact incoming bytes. JSON parsing and reserialization
  // changes the bytes and invalidates both Paystack signature formats.
  rawBody: Uint8Array;
  paystackSignature?: string | null;
  legacySignature?: string | null;
  webhookSecrets?: string[];
  secretKey?: string;
  nowSeconds?: number;
};

const MAX_SKEW_SECONDS = 300;
const SHA512_HEX = /^[0-9a-f]{128}$/;

function matchesHex(expected: Buffer, hex: string): boolean {
  return SHA512_HEX.test(hex) && timingSafeEqual(expected, Buffer.from(hex, "hex"));
}

export function verifySubscriptionWebhookSignature(input: SignatureInput): SubscriptionWebhookSignatureResult {
  const raw = Buffer.from(input.rawBody);
  if (input.paystackSignature) {
    let timestamp: number | null = null;
    const signatures: { keyId: string; hex: string }[] = [];
    for (const part of input.paystackSignature.split(",")) {
      const equalsAt = part.indexOf("=");
      if (equalsAt < 0) continue;
      const name = part.slice(0, equalsAt).trim();
      const value = part.slice(equalsAt + 1).trim();
      if (name === "t") {
        if (timestamp !== null || !/^[0-9]+$/.test(value)) return { valid: false };
        timestamp = Number(value);
      } else if (name === "v1") {
        const colonAt = value.indexOf(":");
        if (colonAt < 0) continue;
        signatures.push({ keyId: value.slice(0, colonAt), hex: value.slice(colonAt + 1) });
      }
    }
    const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (timestamp === null || !Number.isSafeInteger(timestamp)
      || !Number.isSafeInteger(now)
      || Math.abs(now - timestamp) > MAX_SKEW_SECONDS
      || signatures.length === 0) return { valid: false };

    for (const secret of input.webhookSecrets ?? []) {
      if (!secret.startsWith("whsec_")) continue;
      const expected = createHmac("sha512", secret)
        .update(`${timestamp}.`)
        .update(raw)
        .digest();
      for (const { keyId, hex } of signatures) {
        if (keyId.startsWith("whk_") && matchesHex(expected, hex)) {
          return { valid: true, scheme: "current", keyId };
        }
      }
    }
    // Once the current header is present, never downgrade to the legacy
    // signature, even if that weaker header also verifies.
    return { valid: false };
  }

  if (input.secretKey && input.legacySignature) {
    const expected = createHmac("sha512", input.secretKey).update(raw).digest();
    if (matchesHex(expected, input.legacySignature)) return { valid: true, scheme: "legacy" };
  }
  return { valid: false };
}
