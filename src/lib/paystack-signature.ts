import { createHmac, timingSafeEqual } from "node:crypto";

export function isValidPaystackSignature(rawBody: string, signature: string, secretKey: string) {
  if (!/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
